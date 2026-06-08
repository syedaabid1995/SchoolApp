import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { getEffectivePermissionCodesForUser } from '../utils/employeePermissions';
import { planAiOperations } from './aiOperationPlanner.service';
import {
  executeReadOnlyAiOperationPlan,
  summarizeOperationResults,
  validateAiOperationPlan,
} from './aiOperationValidator.service';
import { createAuditLog } from './auditLog.service';
import {
  dryRunAiOperationPlan,
  executeAiOperationPlan,
  formatDryRunSummary,
  formatExecutionSummary,
  isPhase3AExecutablePlan,
  type AiOperationDryRun,
} from './aiOperationExecutor.service';
import {
  AI_TOOL_REGISTRY,
  assertToolAllowed,
  buildActionSummary,
  executeAiTool,
  toAuditJson,
  validateToolPayload,
} from './aiAssistantTools.service';
import type {
  AiAssistantChatRequest,
  AiAssistantChatResponse,
  AiAssistantContext,
  AiOperationPlan,
  AiToolCall,
  AiToolName,
} from '../types/aiAssistant.types';

const chatSchema = z.object({
  message: z.string().trim().max(4000).optional().default(''),
  conversationId: z.string().uuid().optional(),
  confirmActionId: z.string().uuid().optional(),
});

const riskyPattern = /\b(delete|drop|truncate|reset database|direct sql|sql query|payroll|fee|fees|accounting|invoice|backup|restore|approve compliance|reject compliance|delete school|delete user|delete student)\b/i;

const isConfirmation = (message: string) => /^(yes|confirm|confirmed|ok|okay|proceed|execute|do it)$/i.test(message.trim());
const isCancel = (message: string) => /^(no|cancel|stop|discard)$/i.test(message.trim());
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

const formatClassName = (value: string) => {
  const text = normalize(value).replace(/[.?!,;:]+$/g, '');
  if (/^class\s+/i.test(text)) return text.replace(/^class/i, 'Class');
  return `Class ${text}`;
};

const formatSectionName = (value: string) => normalize(value).replace(/^section\s+/i, '').replace(/[.?!,;:]+$/g, '').toUpperCase();

const casualReplies = [
  {
    pattern: /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
    reply: 'Hi. What would you like to work on today?',
  },
  {
    pattern: /^(how are you|how's it going|how are things)\??$/i,
    reply: "I'm good. What can I help you set up or check today?",
  },
  {
    pattern: /^(thanks|thank you|ok thanks|great thanks)\b/i,
    reply: "You're welcome. Send me what you want to do next.",
  },
];

const unsupportedActionReply = (message: string) => {
  if (/\b(create|add)\b.*\bstudent\b|\bstudent\b.*\b(create|add)\b/i.test(message)) {
    return 'I cannot create students from chat yet. I can help you list students or explain where to add them, but student creation still needs the student form for now.';
  }
  if (/\b(create|add)\b.*\bteacher\b|\bteacher\b.*\b(create|add)\b/i.test(message)) {
    return 'I cannot create teachers from chat yet. I can list teachers or guide you to the teacher setup page for now.';
  }
  return null;
};

const conversationalReply = (message: string) => {
  const trimmed = message.trim();
  const unsupported = unsupportedActionReply(trimmed);
  if (unsupported) return unsupported;
  return casualReplies.find((entry) => entry.pattern.test(trimmed))?.reply ?? null;
};

const localToolCall = (message: string): AiToolCall | null => {
  const text = message.trim();

  let match = text.match(/(?:show|list)\s+students\s+in\s+(class\s+[\w -]+)\s+section\s+([\w-]+)/i);
  if (match) return { name: 'list_students_by_class_section', payload: { className: formatClassName(match[1]), sectionName: formatSectionName(match[2]) } };

  match = text.match(/(?:add|assign)\s+section\s+([\w-]+)\s+to\s+(class\s+[\w -]+)/i);
  if (match) return { name: 'assign_section_to_class', payload: { sectionName: formatSectionName(match[1]), className: formatClassName(match[2]) } };

  match = text.match(/create\s+(class\s+[\w -]+)\s+section\s+([\w-]+)/i);
  if (match) return { name: 'assign_section_to_class', payload: { className: formatClassName(match[1]), sectionName: formatSectionName(match[2]) } };

  match = text.match(/create\s+(class\s+[\w -]+)/i);
  if (match) return { name: 'create_class', payload: { name: formatClassName(match[1]) } };

  match = text.match(/create\s+section\s+([\w-]+)/i);
  if (match) return { name: 'create_section', payload: { name: formatSectionName(match[1]) } };

  match = text.match(/(?:create|add)\s+subject\s+([\w -]+)/i);
  if (match) return { name: 'create_subject', payload: { name: normalize(match[1]) } };

  match = text.match(/assign\s+([\w -]+)\s+to\s+(class\s+[\w -]+)\s+section\s+([\w-]+)(?:.*teacher\s+([\w -]+))?/i);
  if (match) {
    return {
      name: 'assign_subject_to_class_section',
      payload: {
        subjectName: normalize(match[1].replace(/subject/i, '')),
        className: formatClassName(match[2]),
        sectionName: formatSectionName(match[3]),
        teacherName: normalize(match[4] ?? ''),
      },
    };
  }

  match = text.match(/create\s+(?:a\s+)?draft\s+exam.*?(class\s+[\w -]+)\s+section\s+([\w-]+)/i);
  if (match) return { name: 'create_exam_draft', payload: { className: formatClassName(match[1]), sectionName: formatSectionName(match[2]) } };

  if (/(show|list).*(class|classes)/i.test(text)) return { name: 'list_classes', payload: {} };
  if (/(show|list).*sections/i.test(text)) return { name: 'list_sections', payload: {} };
  if (/(show|list).*subjects/i.test(text)) return { name: 'list_subjects', payload: {} };
  if (/(show|list).*teachers/i.test(text)) return { name: 'list_teachers', payload: {} };
  if (/(show|list).*exams/i.test(text)) return { name: 'list_exams', payload: {} };
  if (/pending|setup|onboarding/i.test(text)) return { name: 'get_school_onboarding_status', payload: {} };
  if (/where|navigate|open|go to/i.test(text)) return { name: 'navigate_user_to_page', payload: { topic: text } };
  if (/\b(how|what|where|when|why|explain|help|guide|steps?|generate|download|export)\b/i.test(text)) {
    return { name: 'answer_product_question', payload: { question: text } };
  }
  return null;
};

const toolSchemas = Object.values(AI_TOOL_REGISTRY).map((tool) => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: tool.requiredFields ?? [],
      properties: {
        name: { type: 'string' },
        className: { type: 'string' },
        sectionName: { type: 'string' },
        subjectName: { type: 'string' },
        teacherName: { type: 'string' },
        academicYearName: { type: 'string' },
        scheduledAt: { type: 'string' },
        type: { type: 'string' },
        code: { type: 'string' },
        question: { type: 'string' },
        topic: { type: 'string' },
      },
    },
  },
}));

const openAiToolCall = async (message: string): Promise<AiToolCall | null> => {
  if (!env.AI_ASSISTANT_ENABLED || !env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'You are a safe school ERP command router. Select exactly one supported tool. Never choose finance, payroll, deletion, backup/restore execution, compliance approval, or cross-school tools.',
      },
      { role: 'user', content: message },
    ],
    tools: toolSchemas,
    tool_choice: 'auto',
  });
  const call = completion.choices[0]?.message.tool_calls?.[0];
  if (!call || call.type !== 'function') return null;
  if (!(call.function.name in AI_TOOL_REGISTRY)) return null;
  const name = call.function.name as AiToolName;
  const payload = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
  const missing = (AI_TOOL_REGISTRY[name].requiredFields ?? []).filter((field) => !normalize(String(payload[field] ?? '')));
  if (missing.length) return null;
  return {
    name,
    payload,
  };
};

const getToolCall = async (message: string) => {
  try {
    return (await openAiToolCall(message)) ?? localToolCall(message);
  } catch {
    return localToolCall(message);
  }
};

const assistantMessage = async (conversationId: string, message: string) => {
  await prisma.aiMessage.create({ data: { conversationId, role: 'assistant', content: message } });
  return { message, conversationId, requiresConfirmation: false };
};

const ensureCanExecuteAssistantAction = async (ctx: AiAssistantContext) => {
  if (!ctx.schoolId) throw new HttpError(400, 'Select a school context before executing AI assistant actions');
  const permissions = await getEffectivePermissionCodesForUser(ctx.schoolId, ctx.userId, ctx.role);
  if (!permissions.includes('ai.assistant.execute')) {
    throw new HttpError(403, 'You do not have permission to execute AI assistant actions');
  }
};

const getConversation = async (ctx: AiAssistantContext, conversationId: string | undefined, titleSeed: string) => {
  if (conversationId) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: ctx.userId, schoolId: ctx.schoolId },
    });
    if (!conversation) throw new HttpError(404, 'Conversation not found');
    return conversation;
  }
  return prisma.aiConversation.create({
    data: {
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      title: titleSeed.slice(0, 80) || 'AI Assistant',
    },
  });
};

const auditAi = async (
  ctx: AiAssistantContext,
  params: {
    conversationId: string;
    action: string;
    toolName?: string;
    userMessage?: string;
    confirmationRequired?: boolean;
    confirmationStatus?: string;
    success?: boolean;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    errorReason?: string | null;
  },
) => {
  await createAuditLog({
    schoolId: ctx.schoolId,
    actorId: ctx.userId,
    actorRole: ctx.role ?? 'UNKNOWN',
    entityType: 'AI_ASSISTANT',
    entityId: params.conversationId,
    action: params.action,
    beforeState: params.before ? toAuditJson(params.before) : null,
    afterState: toAuditJson({
      toolName: params.toolName,
      userMessage: params.userMessage,
      confirmationRequired: params.confirmationRequired,
      confirmationStatus: params.confirmationStatus,
      success: params.success,
      errorReason: params.errorReason ?? null,
      conversationId: params.conversationId,
    }),
  });
};

const formatToolResult = (toolName: AiToolName, result: unknown) => {
  if (toolName === 'answer_product_question') return (result as any).answer;
  if (toolName === 'navigate_user_to_page') {
    const page = result as { label: string; path: string };
    return `Open ${page.label}: ${page.path}`;
  }
  if (Array.isArray(result)) {
    if (!result.length) return 'No records found.';
    return `Found ${result.length} record${result.length === 1 ? '' : 's'}.`;
  }
  if (toolName === 'get_school_onboarding_status') {
    const status = result as any;
    return `${status.nextStep} Current counts: classes ${status.classes}, sections ${status.sections}, subjects ${status.subjects}, teachers ${status.teachers}, students ${status.students}.`;
  }
  if (toolName === 'get_exam_setup_status') {
    const status = result as any;
    return status.readyForHallTickets
      ? 'Exam setup has exams, centers, rooms, and seating for hall tickets.'
      : `Exam setup is incomplete. Exams: ${status.exams}, centers: ${status.centers}, rooms: ${status.rooms}, seating allocations: ${status.seating}.`;
  }
  return 'Done.';
};

const shouldExposeResultData = (toolName: AiToolName) => !['answer_product_question', 'navigate_user_to_page'].includes(toolName);

const formatOperationPlanSummary = (plan: AiOperationPlan) =>
  plan.preview.length ? plan.preview.join('; ') : plan.summary;

const operationPlanPayload = (payload: unknown) => {
  const raw = payload as any;
  if (raw?.plan?.type === 'operation_plan') {
    return { plan: raw.plan as AiOperationPlan, dryRun: raw.dryRun as AiOperationDryRun | undefined, phase: raw.phase as string | undefined };
  }
  return { plan: raw as AiOperationPlan, dryRun: undefined, phase: undefined };
};

const executePendingAction = async (ctx: AiAssistantContext, actionId: string, userMessage: string) => {
  const action = await prisma.aiPendingAction.findFirst({
    where: { id: actionId, status: 'PENDING', createdById: ctx.userId, schoolId: ctx.schoolId },
  });
  if (!action) throw new HttpError(404, 'Pending action not found');
  if (action.toolName === 'operation_plan') {
    const { plan, dryRun, phase } = operationPlanPayload(action.payload);
    if (phase !== '3A' || !isPhase3AExecutablePlan(plan)) {
      const message = 'This operation plan is preview-only right now. I have not changed any data. Only academic year, class, section, and class-section setup plans can execute in Phase 3A.';
      await prisma.aiPendingAction.update({
        where: { id: action.id },
        data: { status: 'CANCELLED', executedById: ctx.userId, executedAt: new Date() },
      });
      await prisma.aiMessage.create({
        data: {
          conversationId: action.conversationId,
          role: 'assistant',
          content: message,
          toolName: 'operation_plan',
          toolPayload: action.payload,
        },
      });
      return { message, conversationId: action.conversationId, requiresConfirmation: false };
    }
    await ensureCanExecuteAssistantAction(ctx);
    try {
      const result = await executeAiOperationPlan(ctx, plan, dryRun);
      const message = formatExecutionSummary(result);
      await prisma.aiPendingAction.update({
        where: { id: action.id },
        data: { status: 'EXECUTED', executedById: ctx.userId, executedAt: new Date() },
      });
      await prisma.aiMessage.create({
        data: {
          conversationId: action.conversationId,
          role: 'assistant',
          content: message,
          toolName: 'operation_plan',
          toolPayload: action.payload,
        },
      });
      await auditAi(ctx, {
        conversationId: action.conversationId,
        action: 'AI_OPERATION_PLAN_EXECUTED',
        toolName: 'operation_plan',
        userMessage,
        confirmationRequired: true,
        confirmationStatus: 'CONFIRMED',
        success: true,
        after: { result: result as unknown as Record<string, unknown> },
      });
      return { message, conversationId: action.conversationId, requiresConfirmation: false, data: result };
    } catch (err) {
      await prisma.aiPendingAction.update({ where: { id: action.id }, data: { status: 'FAILED' } });
      await auditAi(ctx, {
        conversationId: action.conversationId,
        action: 'AI_OPERATION_PLAN_FAILED',
        toolName: 'operation_plan',
        userMessage,
        confirmationRequired: true,
        confirmationStatus: 'CONFIRMED',
        success: false,
        errorReason: err instanceof Error ? err.message : 'Unknown error',
      });
      const message = `I could not complete this setup plan. ${err instanceof Error ? err.message : 'Please review the setup and try again.'}`;
      await prisma.aiMessage.create({
        data: {
          conversationId: action.conversationId,
          role: 'assistant',
          content: message,
          toolName: 'operation_plan',
          toolPayload: action.payload,
        },
      });
      return { message, conversationId: action.conversationId, requiresConfirmation: false };
    }
  }
  const toolName = action.toolName as AiToolName;
  assertToolAllowed(ctx, toolName);
  await ensureCanExecuteAssistantAction(ctx);

  try {
    const result = await executeAiTool(ctx, toolName, action.payload as Record<string, unknown>);
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: 'EXECUTED', executedById: ctx.userId, executedAt: new Date() },
    });
    await prisma.aiMessage.create({
      data: {
        conversationId: action.conversationId,
        role: 'assistant',
        content: `${action.summary ?? buildActionSummary(toolName, action.payload as Record<string, unknown>)} completed.`,
        toolName,
        toolPayload: action.payload,
      },
    });
    await auditAi(ctx, {
      conversationId: action.conversationId,
      action: 'AI_ACTION_EXECUTED',
      toolName,
      userMessage,
      confirmationRequired: true,
      confirmationStatus: 'CONFIRMED',
      success: true,
      after: { result: result as Record<string, unknown> },
    });
    return {
      message: `${action.summary ?? 'Action'} completed.`,
      conversationId: action.conversationId,
      requiresConfirmation: false,
      data: result,
    };
  } catch (err) {
    await prisma.aiPendingAction.update({ where: { id: action.id }, data: { status: 'FAILED' } });
    await auditAi(ctx, {
      conversationId: action.conversationId,
      action: 'AI_ACTION_FAILED',
      toolName,
      userMessage,
      confirmationRequired: true,
      confirmationStatus: 'CONFIRMED',
      success: false,
      errorReason: err instanceof Error ? err.message : 'Unknown error',
    });
    throw err;
  }
};

export const handleAiAssistantChat = async (ctx: AiAssistantContext, rawBody: unknown): Promise<AiAssistantChatResponse> => {
  const body: AiAssistantChatRequest = chatSchema.parse(rawBody);
  if (!ctx.userId) throw new HttpError(401, 'Unauthorized');
  const messageText = body.message ?? '';
  const conversation = await getConversation(ctx, body.conversationId, messageText);

  if (body.confirmActionId) return executePendingAction(ctx, body.confirmActionId, messageText || 'confirm');

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, userId: ctx.userId, role: 'user', content: messageText },
  });

  if (riskyPattern.test(messageText)) {
    const message = 'I cannot perform finance, payroll, deletion, direct SQL, backup/restore execution, or compliance approval actions.';
    await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: message } });
    await auditAi(ctx, { conversationId: conversation.id, action: 'AI_REQUEST_REFUSED', userMessage: messageText, success: false, errorReason: 'High-risk or unsupported request' });
    return { message, conversationId: conversation.id, requiresConfirmation: false };
  }

  if (isCancel(messageText)) {
    await prisma.aiPendingAction.updateMany({
      where: { conversationId: conversation.id, createdById: ctx.userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    return { message: 'Pending action cancelled.', conversationId: conversation.id, requiresConfirmation: false };
  }

  if (isConfirmation(messageText)) {
    const latest = await prisma.aiPendingAction.findFirst({
      where: { conversationId: conversation.id, createdById: ctx.userId, schoolId: ctx.schoolId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      const latestAssistant = await prisma.aiMessage.findFirst({
        where: { conversationId: conversation.id, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });
      if (latestAssistant?.toolName && /(please confirm|would you like me to proceed|proceed\?)/i.test(latestAssistant.content)) {
        return executePendingAction(ctx, latest.id, messageText);
      }
    }
    return assistantMessage(conversation.id, 'There is no action waiting for confirmation. Tell me what you want to do next.');
  }

  const naturalReply = conversationalReply(messageText);
  if (naturalReply) return assistantMessage(conversation.id, naturalReply);

  const legacyMutationCandidate = localToolCall(messageText);
  const shouldUseLegacyMutation =
    legacyMutationCandidate ? Boolean(AI_TOOL_REGISTRY[legacyMutationCandidate.name]?.mutation) : false;

  const operationPlan = shouldUseLegacyMutation ? null : await planAiOperations(messageText);
  if (operationPlan) {
    if (operationPlan.type === 'follow_up') {
      return assistantMessage(conversation.id, operationPlan.message);
    }
    const validatedPlan = await validateAiOperationPlan(ctx, operationPlan);
    if (validatedPlan.status === 'READ_ONLY_EXECUTABLE') {
      const result = await executeReadOnlyAiOperationPlan(ctx, validatedPlan);
      const message = summarizeOperationResults(result);
      await prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: message,
          toolName: 'operation_plan',
          toolPayload: toAuditJson(validatedPlan as unknown as Record<string, unknown>),
        },
      });
      return { message, conversationId: conversation.id, requiresConfirmation: false, data: result };
    }

    if (shouldUseLegacyMutation) {
      // Keep known feature-specific mutations on the existing execution path until the generic executor is enabled.
    } else {

      await ensureCanExecuteAssistantAction(ctx);
      const summary = formatOperationPlanSummary(validatedPlan);
      const executablePhase3A = isPhase3AExecutablePlan(validatedPlan);
      const dryRun = executablePhase3A ? await dryRunAiOperationPlan(ctx, validatedPlan) : null;
      if (dryRun && !dryRun.creates) {
        const message = formatDryRunSummary(dryRun);
        await prisma.aiMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: message,
            toolName: 'operation_plan',
            toolPayload: toAuditJson({ plan: validatedPlan, dryRun, phase: '3A' }),
          },
        });
        return { message, conversationId: conversation.id, requiresConfirmation: false, data: { plan: validatedPlan, dryRun } };
      }
      const action = await prisma.aiPendingAction.create({
        data: {
          conversationId: conversation.id,
          schoolId: ctx.schoolId,
          toolName: 'operation_plan',
          payload: toAuditJson((dryRun ? { plan: validatedPlan, dryRun, phase: '3A' } : validatedPlan) as unknown as Record<string, unknown>),
          risk: validatedPlan.risk,
          summary,
          createdById: ctx.userId,
        },
      });
      const message = dryRun
        ? formatDryRunSummary(dryRun)
        : `I prepared this operation plan for review: ${summary}. Generic execution is not enabled for this entity yet, so confirming will not change data.`;
      await prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: message,
          toolName: 'operation_plan',
          toolPayload: toAuditJson((dryRun ? { plan: validatedPlan, dryRun, phase: '3A' } : validatedPlan) as unknown as Record<string, unknown>),
        },
      });
      await auditAi(ctx, {
        conversationId: conversation.id,
        action: 'AI_OPERATION_PLAN_PREPARED',
        toolName: 'operation_plan',
        userMessage: messageText,
        confirmationRequired: true,
        confirmationStatus: 'PREVIEW_ONLY',
        success: true,
        after: { plan: validatedPlan as unknown as Record<string, unknown> },
      });
      return {
        message,
        conversationId: conversation.id,
        requiresConfirmation: true,
        action: {
          id: action.id,
          name: 'operation_plan',
          summary,
          risk: validatedPlan.risk,
          operationCount: validatedPlan.operations.length,
          preview: validatedPlan.preview,
        },
      };
    }
  }

  const toolCall = await getToolCall(messageText);
  if (!toolCall) {
    return assistantMessage(conversation.id, "I didn't catch a school action in that. You can ask me to show records, explain a workflow, or prepare a setup action.");
  }
  const tool = AI_TOOL_REGISTRY[toolCall.name];
  assertToolAllowed(ctx, toolCall.name);
  validateToolPayload(toolCall.name, toolCall.payload);
  if (tool.mutation) await ensureCanExecuteAssistantAction(ctx);

  if (tool.mutation && env.AI_ASSISTANT_REQUIRE_CONFIRMATION) {
    const summary = buildActionSummary(toolCall.name, toolCall.payload);
    const action = await prisma.aiPendingAction.create({
      data: {
        conversationId: conversation.id,
        schoolId: ctx.schoolId,
        toolName: toolCall.name,
        payload: toAuditJson(toolCall.payload),
        risk: tool.risk,
        summary,
        createdById: ctx.userId,
      },
    });
    const message = `I can ${summary.charAt(0).toLowerCase()}${summary.slice(1)}. Please confirm.`;
    await prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: message, toolName: toolCall.name, toolPayload: toAuditJson(toolCall.payload) },
    });
    await auditAi(ctx, {
      conversationId: conversation.id,
      action: 'AI_ACTION_PREPARED',
      toolName: toolCall.name,
      userMessage: messageText,
      confirmationRequired: true,
      confirmationStatus: 'PENDING',
      success: true,
    });
    return {
      message,
      conversationId: conversation.id,
      requiresConfirmation: true,
      action: { id: action.id, name: toolCall.name, summary, risk: tool.risk },
    };
  }

  const result = await executeAiTool(ctx, toolCall.name, toolCall.payload);
  const message = formatToolResult(toolCall.name, result);
  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: 'assistant', content: message, toolName: toolCall.name, toolPayload: toAuditJson(toolCall.payload) },
  });
  const data = shouldExposeResultData(toolCall.name) ? result : undefined;
  return { message, conversationId: conversation.id, requiresConfirmation: false, data };
};

export const validateAiAssistantRequest = chatSchema.parse;
