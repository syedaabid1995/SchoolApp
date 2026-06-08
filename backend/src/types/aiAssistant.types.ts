import type { AuthContext } from '../middlewares/auth.middleware';

export type AiActionRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type AiPendingActionStatus = 'PENDING' | 'CONFIRMED' | 'EXECUTED' | 'CANCELLED' | 'FAILED';

export type AiToolName =
  | 'get_school_onboarding_status'
  | 'list_academic_years'
  | 'list_classes'
  | 'list_sections'
  | 'list_class_sections'
  | 'list_subjects'
  | 'list_teachers'
  | 'list_students_by_class_section'
  | 'list_exams'
  | 'get_exam_setup_status'
  | 'create_class'
  | 'create_section'
  | 'assign_section_to_class'
  | 'create_subject'
  | 'assign_subject_to_class_section'
  | 'create_teacher_basic'
  | 'create_student_basic'
  | 'create_exam_draft'
  | 'answer_product_question'
  | 'explain_next_setup_step'
  | 'navigate_user_to_page';

export type AiToolCall = {
  name: AiToolName;
  payload: Record<string, unknown>;
};

export type AiActionSummary = {
  id: string;
  name: AiToolName | 'operation_plan';
  summary: string;
  risk: AiActionRisk;
  operationCount?: number;
  preview?: string[];
};

export type AiAssistantChatRequest = {
  message?: string;
  conversationId?: string;
  confirmActionId?: string;
};

export type AiAssistantChatResponse = {
  message: string;
  conversationId: string;
  requiresConfirmation: boolean;
  action?: AiActionSummary;
  data?: unknown;
};

export type AiAssistantContext = {
  auth: AuthContext;
  role: string | null;
  schoolId: string | null;
  userId: string;
};

export type AiToolDefinition = {
  name: AiToolName;
  description: string;
  mutation: boolean;
  risk: AiActionRisk;
  allowedRoles: string[];
  requiredFields?: string[];
};

export type AiOperationAction = 'findRecords' | 'createRecord' | 'bulkCreateRecords' | 'updateRecord' | 'linkRecords';
export type AiOperationStatus = 'READ_ONLY_EXECUTABLE' | 'WRITE_PREVIEW_ONLY';

export type AiOperationFilter = {
  field: string;
  op?: 'equals' | 'contains' | 'in' | 'none';
  value: unknown;
};

export type AiOperation = {
  action: AiOperationAction;
  entity: string;
  filters?: AiOperationFilter[];
  data?: Record<string, unknown> | Record<string, unknown>[];
  relation?: string;
  mappings?: Array<Record<string, unknown>>;
  limit?: number;
};

export type AiOperationPlan = {
  type: 'operation_plan';
  status: AiOperationStatus;
  summary: string;
  risk: AiActionRisk;
  operations: AiOperation[];
  preview: string[];
};

export type AiPlannerFollowUp = {
  type: 'follow_up';
  message: string;
  missingFields: string[];
  risk: AiActionRisk;
};

export type AiPlannerResult = AiOperationPlan | AiPlannerFollowUp;

export type AiEntityFieldType = 'string' | 'boolean' | 'date' | 'uuid' | 'enum';

export type AiEntityFieldDefinition = {
  type: AiEntityFieldType;
  required?: boolean;
  writable?: boolean;
  filterable?: boolean;
  aliases?: string[];
  enumValues?: string[];
};

export type AiEntityDefinition = {
  entity: string;
  prismaModel: string;
  label: string;
  pluralLabel: string;
  schoolScoped: boolean;
  allowedActions: AiOperationAction[];
  readableFields: string[];
  defaultOrderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  defaultLimit?: number;
  maxLimit?: number;
  maxBulkCount?: number;
  permissions: Partial<Record<AiOperationAction, string[]>>;
  fields: Record<string, AiEntityFieldDefinition>;
};
