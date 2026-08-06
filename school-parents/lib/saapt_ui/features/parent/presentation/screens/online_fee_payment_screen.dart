import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/network/parent_api_client.dart';
import '../../data/parent_models.dart';
import '../providers/parent_providers.dart';
import 'parent_fee_payment_screen.dart';
import 'parent_screen_widgets.dart';

class OnlineFeePaymentScreen extends ConsumerStatefulWidget {
  const OnlineFeePaymentScreen({super.key, this.initialChildId});

  final String? initialChildId;

  @override
  ConsumerState<OnlineFeePaymentScreen> createState() =>
      _OnlineFeePaymentScreenState();
}

class _OnlineFeePaymentScreenState
    extends ConsumerState<OnlineFeePaymentScreen> {
  String? _lastChildId;
  final Set<String> _selectedInvoiceIds = {};
  final Set<String> _expandedInvoiceIds = {};
  bool _paying = false;
  String? _payProgress;

  static final _money = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    final initial = widget.initialChildId?.trim();
    if (initial != null && initial.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(selectedChildIdProvider.notifier).state = initial;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final childrenState = ref.watch(parentChildrenProvider);
    final selectedChild = ref.watch(effectiveSelectedChildProvider).asData?.value;
    final selectedId = selectedChild?.id;
    if (selectedId != null && selectedId != _lastChildId) {
      final previous = _lastChildId;
      _lastChildId = selectedId;
      if (previous != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          setState(() {
            _selectedInvoiceIds.clear();
            _expandedInvoiceIds.clear();
          });
        });
      }
    }

    final breakdownState = selectedId == null
        ? null
        : ref.watch(parentFeeBreakdownProvider(selectedId));

    return Scaffold(
      backgroundColor: SaaptTheme.canvas,
      body: Stack(
        children: [
          childrenState.when(
            loading: () => const LoadingPanel(),
            error: (error, _) => EmptyPanel(
              message: parentApiError(error, 'Unable to load children'),
            ),
            data: (kids) {
              if (kids.isEmpty) {
                return CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(child: _buildHero(context, null)),
                    const SliverPadding(
                      padding: EdgeInsets.all(20),
                      sliver: SliverToBoxAdapter(
                        child: EmptyPanel(
                          message:
                              'No children are linked to this parent account.',
                        ),
                      ),
                    ),
                  ],
                );
              }
              return Column(
                children: [
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () async {
                        if (selectedId != null) {
                          ref.invalidate(parentFeeBreakdownProvider(selectedId));
                        }
                        ref.invalidate(parentChildrenProvider);
                      },
                      child: ListView(
                        padding: EdgeInsets.zero,
                        children: [
                          _buildHero(context, selectedChild),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const Text(
                                  'Fee Breakdown',
                                  style: TextStyle(
                                    color: SaaptTheme.primary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                if (selectedId == null || breakdownState == null)
                                  const EmptyPanel(
                                    message:
                                        'Select a student from the header.',
                                  )
                                else
                                  breakdownState.when(
                                    loading: () => const Padding(
                                      padding: EdgeInsets.symmetric(
                                        vertical: 48,
                                      ),
                                      child: Center(
                                        child: CircularProgressIndicator(),
                                      ),
                                    ),
                                    error: (error, _) => EmptyPanel(
                                      message: parentApiError(
                                        error,
                                        'Unable to load fee breakdown',
                                      ),
                                    ),
                                    data: (breakdown) => _BreakdownBody(
                                      breakdown: breakdown,
                                      selectedInvoiceIds: _selectedInvoiceIds,
                                      expandedInvoiceIds: _expandedInvoiceIds,
                                      money: _money,
                                      onToggleExpand: (id) {
                                        setState(() {
                                          if (_expandedInvoiceIds.contains(
                                            id,
                                          )) {
                                            _expandedInvoiceIds.remove(id);
                                          } else {
                                            _expandedInvoiceIds.add(id);
                                          }
                                        });
                                      },
                                      onToggleSelect: (item, selected) {
                                        if (!item.canPay) return;
                                        setState(() {
                                          if (selected) {
                                            _selectedInvoiceIds.add(item.id);
                                          } else {
                                            _selectedInvoiceIds.remove(item.id);
                                          }
                                        });
                                      },
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  _PayNowBar(
                    enabled:
                        !_paying &&
                        selectedId != null &&
                        _selectedInvoiceIds.isNotEmpty,
                    count: _selectedInvoiceIds.length,
                    onPressed: () => _openAmountSheet(
                      selectedId!,
                      breakdownState?.asData?.value,
                    ),
                  ),
                ],
              );
            },
          ),
          if (_paying)
            ColoredBox(
              color: const Color(0x66000000),
              child: Center(
                child: ParentCard(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: 14),
                      Text(
                        _payProgress ?? 'Opening payment...',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: SaaptTheme.navy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHero(BuildContext context, ParentChild? selectedChild) {
    return ParentHero(
      showChildSwitcher: true,
      badge: '💳 Online Fee Payment',
      title: selectedChild?.name ?? 'Online Fee Payment',
      subtitle: selectedChild == null
          ? 'Select a student to pay fees'
          : '${selectedChild.classLabel} • Pay school fees online',
      leading: IconButton(
        tooltip: 'Back',
        style: IconButton.styleFrom(
          backgroundColor: Colors.white.withValues(alpha: 0.16),
          foregroundColor: Colors.white,
        ),
        onPressed: () => Navigator.of(context).maybePop(),
        icon: const Icon(Icons.arrow_back_rounded),
      ),
    );
  }

  Future<void> _openAmountSheet(
    String childId,
    ParentFeeBreakdown? breakdown,
  ) async {
    if (breakdown == null) return;
    final selectedItems = breakdown.items
        .where((item) => _selectedInvoiceIds.contains(item.id) && item.canPay)
        .toList();
    if (selectedItems.isEmpty) return;

    final lines = await showModalBottomSheet<List<ParentFeeCheckoutLine>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) => _MultiFeePaymentAmountSheet(items: selectedItems),
    );
    if (lines == null || lines.isEmpty) return;
    await _payLines(childId: childId, lines: lines);
  }

  Future<void> _payLines({
    required String childId,
    required List<ParentFeeCheckoutLine> lines,
  }) async {
    final total = lines.fold<num>(0, (sum, line) => sum + line.amount);
    setState(() {
      _paying = true;
      _payProgress = lines.length == 1
          ? 'Opening payment...'
          : 'Opening payment for ₹${total.toStringAsFixed(0)}...';
    });

    final repository = ref.read(parentRepositoryProvider);

    try {
      final checkout = await repository.createFeeCheckoutOrders(
        childId: childId,
        items: lines,
      );
      if (checkout.paymentLinkId.isEmpty || checkout.paymentUrl.isEmpty) {
        throw StateError('Payment Link details are missing');
      }
      if (!mounted) return;

      final paid = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => ParentFeePaymentScreen(
            paymentUrl: checkout.paymentUrl,
            paymentLinkId: checkout.paymentLinkId,
          ),
        ),
      );

      ref.invalidate(parentFeeBreakdownProvider(childId));
      ref.invalidate(parentChildDetailProvider(childId));
      final childState = ref.read(effectiveSelectedChildProvider);
      final child = childState.asData?.value;
      if (child != null && child.id == childId) {
        ref.invalidate(parentFeeSummaryProvider(child));
      }

      if (!mounted) return;
      if (paid == true) {
        setState(() => _selectedInvoiceIds.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment completed successfully.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment was cancelled.')),
        );
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(parentApiError(error, 'Unable to complete payment')),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _paying = false;
          _payProgress = null;
        });
      }
    }
  }
}

class _BreakdownBody extends StatelessWidget {
  const _BreakdownBody({
    required this.breakdown,
    required this.selectedInvoiceIds,
    required this.expandedInvoiceIds,
    required this.money,
    required this.onToggleExpand,
    required this.onToggleSelect,
  });

  final ParentFeeBreakdown breakdown;
  final Set<String> selectedInvoiceIds;
  final Set<String> expandedInvoiceIds;
  final NumberFormat money;
  final ValueChanged<String> onToggleExpand;
  final void Function(ParentFeeInvoiceItem item, bool selected) onToggleSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: _SummaryTile(
                label: 'Total Payable',
                value: money.format(breakdown.summary.total),
                color: SaaptTheme.primary,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryTile(
                label: 'Total Paid',
                value: money.format(breakdown.summary.paid),
                color: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _SummaryTile(
                label: 'Total Due',
                value: money.format(breakdown.summary.due),
                color: const Color(0xFFDC2626),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (breakdown.items.isEmpty)
          const EmptyPanel(message: 'No fee invoices found for this student.')
        else
          ...breakdown.items.map((item) {
            final expanded = expandedInvoiceIds.contains(item.id);
            final selected = selectedInvoiceIds.contains(item.id);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _FeeBreakdownCard(
                item: item,
                expanded: expanded,
                selected: selected,
                money: money,
                onToggleExpand: () => onToggleExpand(item.id),
                onToggleSelect: (value) => onToggleSelect(item, value),
              ),
            );
          }),
      ],
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Column(
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF8EA0BA),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeeBreakdownCard extends StatelessWidget {
  const _FeeBreakdownCard({
    required this.item,
    required this.expanded,
    required this.selected,
    required this.money,
    required this.onToggleExpand,
    required this.onToggleSelect,
  });

  final ParentFeeInvoiceItem item;
  final bool expanded;
  final bool selected;
  final NumberFormat money;
  final VoidCallback onToggleExpand;
  final ValueChanged<bool> onToggleSelect;

  @override
  Widget build(BuildContext context) {
    final dueLabel = item.due > 0
        ? '${money.format(item.due)} Due'
        : '${money.format(item.paid)} Paid';
    final dueColor = item.due > 0
        ? const Color(0xFFDC2626)
        : const Color(0xFF059669);

    return ParentCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          InkWell(
            onTap: onToggleExpand,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 10, 12, 10),
              child: Row(
                children: [
                  Checkbox(
                    value: selected,
                    onChanged: item.canPay
                        ? (value) => onToggleSelect(value ?? false)
                        : null,
                  ),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF1FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.menu_book_rounded,
                      color: SaaptTheme.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: SaaptTheme.navy,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    dueLabel,
                    style: TextStyle(
                      color: dueColor,
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                    ),
                  ),
                  Icon(
                    expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFF8EA0BA),
                  ),
                ],
              ),
            ),
          ),
          if (expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _MiniAmount(
                          label: 'Allotted',
                          value: money.format(item.allotted),
                          color: SaaptTheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _MiniAmount(
                          label: 'Paid',
                          value: money.format(item.paid),
                          color: const Color(0xFF059669),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _MiniAmount(
                          label: 'Due',
                          value: money.format(item.due),
                          color: const Color(0xFFDC2626),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Payment history',
                    style: TextStyle(
                      color: SaaptTheme.navy,
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (item.paymentHistory.isEmpty)
                    const Text(
                      'No payments recorded yet.',
                      style: TextStyle(
                        color: Color(0xFF8EA0BA),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  else
                    ...item.paymentHistory.map(
                      (payment) => _FeePaymentHistoryRow(
                        payment: payment,
                        money: money,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _FeePaymentHistoryRow extends StatelessWidget {
  const _FeePaymentHistoryRow({
    required this.payment,
    required this.money,
  });

  final ParentFeePaymentHistoryEntry payment;
  final NumberFormat money;

  @override
  Widget build(BuildContext context) {
    final modeLabel = payment.paymentMode.replaceAll('_', ' ');
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFFE9F8EF),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Icon(
              Icons.check_rounded,
              color: Color(0xFF059669),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payment.paymentNumber,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: SaaptTheme.navy,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '$modeLabel • ${_formatPaidAt(payment.paidAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF60708F),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '+${money.format(payment.amount)}',
                style: const TextStyle(
                  color: Color(0xFF059669),
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (payment.receiptNumber?.trim().isNotEmpty == true) ...[
                const SizedBox(height: 3),
                Text(
                  'Receipt ${payment.receiptNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF8EA0BA),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  String _formatPaidAt(String? value) {
    final date = DateTime.tryParse(value ?? '');
    if (date == null) return '-';
    return DateFormat('dd-MM-yyyy').format(date.toLocal());
  }
}

class _MiniAmount extends StatelessWidget {
  const _MiniAmount({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF8EA0BA),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PayNowBar extends StatelessWidget {
  const _PayNowBar({
    required this.enabled,
    required this.count,
    required this.onPressed,
  });

  final bool enabled;
  final int count;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 12,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: enabled ? onPressed : null,
            icon: const Icon(Icons.credit_card_rounded),
            label: Text(
              count <= 0
                  ? 'View / Pay Now'
                  : 'View / Pay Now ($count)',
            ),
            style: FilledButton.styleFrom(
              backgroundColor: SaaptTheme.primary,
              foregroundColor: Colors.white,
              disabledBackgroundColor: const Color(0xFFC9D4EA),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MultiFeePaymentAmountSheet extends StatefulWidget {
  const _MultiFeePaymentAmountSheet({required this.items});

  final List<ParentFeeInvoiceItem> items;

  @override
  State<_MultiFeePaymentAmountSheet> createState() =>
      _MultiFeePaymentAmountSheetState();
}

class _MultiFeePaymentAmountSheetState
    extends State<_MultiFeePaymentAmountSheet> {
  late final List<_AmountDraft> _drafts;

  @override
  void initState() {
    super.initState();
    _drafts = widget.items
        .map(
          (item) => _AmountDraft(
            item: item,
            controller: TextEditingController(
              text: item.due.toStringAsFixed(0),
            ),
          ),
        )
        .toList();
  }

  @override
  void dispose() {
    for (final draft in _drafts) {
      draft.controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(22, 4, 22, 22 + bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Pay fees',
                style: TextStyle(
                  color: SaaptTheme.navy,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.items.length == 1
                    ? 'Choose full balance or a custom amount.'
                    : 'Set the amount for each selected fee item.',
                style: const TextStyle(
                  color: Color(0xFF60708F),
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 16),
              ..._drafts.map((draft) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _InvoiceAmountEditor(
                    draft: draft,
                    onChanged: () => setState(() {}),
                  ),
                );
              }),
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF1FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Total payable now',
                        style: TextStyle(
                          color: SaaptTheme.navy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Text(
                      NumberFormat.currency(
                        locale: 'en_IN',
                        symbol: '₹',
                        decimalDigits: 0,
                      ).format(_currentTotal()),
                      style: const TextStyle(
                        color: SaaptTheme.primary,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: SaaptTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text('Continue to Razorpay'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  num _currentTotal() {
    return _drafts.fold<num>(0, (sum, draft) {
      if (!draft.custom) return sum + draft.item.due;
      return sum + (num.tryParse(draft.controller.text.trim()) ?? 0);
    });
  }

  void _submit() {
    final lines = <ParentFeeCheckoutLine>[];
    for (final draft in _drafts) {
      final amount = num.tryParse(draft.controller.text.trim());
      if (amount == null || amount <= 0) {
        setState(() => draft.error = 'Enter a valid amount.');
        return;
      }
      if (amount > draft.item.due) {
        setState(() => draft.error = 'Amount cannot exceed the balance.');
        return;
      }
      draft.error = null;
      lines.add(
        ParentFeeCheckoutLine(
          invoiceId: draft.item.id,
          title: draft.item.title,
          amount: amount,
        ),
      );
    }
    Navigator.of(context).pop(lines);
  }
}

class _AmountDraft {
  _AmountDraft({
    required this.item,
    required this.controller,
  });

  final ParentFeeInvoiceItem item;
  final TextEditingController controller;
  bool custom = false;
  String? error;
}

class _InvoiceAmountEditor extends StatelessWidget {
  const _InvoiceAmountEditor({
    required this.draft,
    required this.onChanged,
  });

  final _AmountDraft draft;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5ECF7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            draft.item.title,
            style: const TextStyle(
              color: SaaptTheme.navy,
              fontWeight: FontWeight.w900,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Balance due: ${money.format(draft.item.due)}',
            style: const TextStyle(
              color: Color(0xFF60708F),
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Full balance')),
              ButtonSegment(value: true, label: Text('Custom amount')),
            ],
            selected: {draft.custom},
            onSelectionChanged: (value) {
              draft.custom = value.first;
              draft.error = null;
              if (!draft.custom) {
                draft.controller.text = draft.item.due.toStringAsFixed(0);
              }
              onChanged();
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: draft.controller,
            enabled: draft.custom,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Amount',
              prefixText: '₹ ',
              errorText: draft.error,
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
