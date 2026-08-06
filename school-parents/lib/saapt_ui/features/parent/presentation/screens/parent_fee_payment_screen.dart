import 'dart:collection';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/saapt_theme.dart';
import '../../../../core/network/parent_api_client.dart';
import '../providers/parent_providers.dart';

class ParentFeePaymentScreen extends ConsumerStatefulWidget {
  const ParentFeePaymentScreen({
    super.key,
    required this.paymentUrl,
    required this.paymentLinkId,
  });

  final String paymentUrl;
  final String paymentLinkId;

  @override
  ConsumerState<ParentFeePaymentScreen> createState() =>
      _ParentFeePaymentScreenState();
}

class _ParentFeePaymentScreenState extends ConsumerState<ParentFeePaymentScreen>
    with WidgetsBindingObserver {
  static const _upiIntentChannel = MethodChannel('com.saapt.parent/upi_intent');
  static const _upiIntentHandlerName = 'parentUpiIntent';
  static const _callbackPath = '/payment/parent-fee/complete';
  static const _externalPaymentSchemes = {
    'upi',
    'intent',
    'gpay',
    'tez',
    'phonepe',
    'paytm',
    'paytmmp',
    'credpay',
    'mobikwik',
    'bhim',
    'amazonpay',
    'navi',
    'payzapp',
    'icici',
    'in.fampay.app',
    'whatsapp',
    'market',
  };
  static const _upiIntentBridgeScript = r'''
(function() {
  if (window.__parentUpiIntentBridgeInstalled) return;
  window.__parentUpiIntentBridgeInstalled = true;

  var handlerName = 'parentUpiIntent';
  var pendingUrls = [];
  var paymentSchemes = {
    'upi': true, 'intent': true, 'gpay': true, 'tez': true,
    'phonepe': true, 'paytm': true, 'paytmmp': true, 'credpay': true,
    'mobikwik': true, 'bhim': true, 'amazonpay': true, 'navi': true,
    'payzapp': true, 'icici': true, 'in.fampay.app': true,
    'whatsapp': true, 'market': true
  };

  function schemeFor(url) {
    if (!url || typeof url !== 'string') return '';
    var match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    return match ? match[1].toLowerCase() : '';
  }

  function isPaymentUrl(url) {
    return paymentSchemes[schemeFor(url)] === true;
  }

  function flushPending() {
    if (!window.flutter_inappwebview ||
        !window.flutter_inappwebview.callHandler) return;
    while (pendingUrls.length > 0) {
      window.flutter_inappwebview.callHandler(
        handlerName,
        pendingUrls.shift()
      );
    }
  }

  function sendToFlutter(url) {
    if (!isPaymentUrl(url)) return false;
    try {
      if (window.flutter_inappwebview &&
          window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview.callHandler(handlerName, url);
      } else {
        pendingUrls.push(url);
      }
    } catch (_) {
      pendingUrls.push(url);
    }
    return true;
  }

  window.addEventListener('flutterInAppWebViewPlatformReady', flushPending);
  setTimeout(flushPending, 0);

  try {
    var originalOpen = window.open;
    window.open = function(url) {
      if (sendToFlutter(String(url || ''))) return null;
      return originalOpen.apply(window, arguments);
    };
  } catch (_) {}

  try {
    var originalAssign = window.Location && window.Location.prototype.assign;
    if (originalAssign) {
      window.Location.prototype.assign = function(url) {
        if (sendToFlutter(String(url || ''))) return;
        return originalAssign.apply(this, arguments);
      };
    }
  } catch (_) {}

  try {
    var originalReplace = window.Location && window.Location.prototype.replace;
    if (originalReplace) {
      window.Location.prototype.replace = function(url) {
        if (sendToFlutter(String(url || ''))) return;
        return originalReplace.apply(this, arguments);
      };
    }
  } catch (_) {}

  try {
    var descriptor =
      Object.getOwnPropertyDescriptor(window.Location.prototype, 'href') ||
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(window.location),
        'href'
      );
    if (descriptor && descriptor.set && descriptor.configurable !== false) {
      Object.defineProperty(window.Location.prototype, 'href', {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set: function(url) {
          if (sendToFlutter(String(url || ''))) return;
          descriptor.set.call(this, url);
        }
      });
    }
  } catch (_) {}

  try {
    var originalAnchorClick =
      window.HTMLAnchorElement && window.HTMLAnchorElement.prototype.click;
    if (originalAnchorClick) {
      window.HTMLAnchorElement.prototype.click = function() {
        if (this.href && sendToFlutter(this.href)) return;
        return originalAnchorClick.apply(this, arguments);
      };
    }
  } catch (_) {}

  try {
    var originalSetAttribute =
      window.Element && window.Element.prototype.setAttribute;
    if (originalSetAttribute) {
      window.Element.prototype.setAttribute = function(name, value) {
        var normalizedName = String(name || '').toLowerCase();
        if ((normalizedName === 'href' ||
             normalizedName === 'src' ||
             normalizedName === 'action' ||
             normalizedName === 'data') &&
            sendToFlutter(String(value || ''))) {
          return;
        }
        return originalSetAttribute.apply(this, arguments);
      };
    }
  } catch (_) {}

  document.addEventListener('click', function(event) {
    var target = event.target;
    var anchor = target && target.closest
      ? target.closest('a[href]')
      : null;
    if (anchor && anchor.href && sendToFlutter(anchor.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
    }
  }, true);
})();
''';

  InAppWebViewController? _webViewController;
  bool _confirming = false;
  bool _finished = false;
  double _progress = 0;
  String? _lastExternalUrl;
  DateTime? _lastExternalLaunchAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _lastExternalUrl != null) {
      _confirmPayment(retry: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay fees'),
        backgroundColor: Colors.white,
        foregroundColor: SaaptTheme.navy,
      ),
      body: Stack(
        children: [
          InAppWebView(
            initialUrlRequest: URLRequest(url: WebUri(widget.paymentUrl)),
            initialUserScripts: UnmodifiableListView([
              UserScript(
                source: _upiIntentBridgeScript,
                injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
                forMainFrameOnly: false,
                allowedOriginRules: const {'*'},
                contentWorld: ContentWorld.PAGE,
              ),
            ]),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              javaScriptCanOpenWindowsAutomatically: true,
              supportMultipleWindows: true,
              useShouldOverrideUrlLoading: true,
              useShouldInterceptRequest: true,
              resourceCustomSchemes: _externalPaymentSchemes.toList(),
            ),
            onWebViewCreated: (controller) {
              _webViewController = controller;
              controller.addJavaScriptHandler(
                handlerName: _upiIntentHandlerName,
                callback: (arguments) async {
                  final url = arguments.isEmpty
                      ? null
                      : arguments.first?.toString();
                  if (url == null || url.trim().isEmpty) return false;
                  return _handleExternalPaymentUrl(WebUri(url));
                },
              );
            },
            onProgressChanged: (_, progress) {
              if (mounted) setState(() => _progress = progress / 100);
            },
            shouldOverrideUrlLoading: (_, navigationAction) async {
              final url = navigationAction.request.url;
              if (url == null) return NavigationActionPolicy.ALLOW;
              if (await _handleCallbackUrl(url)) {
                return NavigationActionPolicy.CANCEL;
              }
              return await _handleExternalPaymentUrl(url)
                  ? NavigationActionPolicy.CANCEL
                  : NavigationActionPolicy.ALLOW;
            },
            onCreateWindow: (controller, createWindowAction) async {
              final url = createWindowAction.request.url;
              if (url == null) return false;
              if (await _handleCallbackUrl(url) ||
                  await _handleExternalPaymentUrl(url)) {
                return true;
              }
              await controller.loadUrl(urlRequest: URLRequest(url: url));
              return true;
            },
            onLoadStart: (controller, url) async {
              if (url == null) return;
              if (await _handleCallbackUrl(url) ||
                  await _handleExternalPaymentUrl(url)) {
                await controller.stopLoading();
              }
            },
            onLoadStop: (_, url) async {
              if (url != null) await _handleCallbackUrl(url);
            },
            onUpdateVisitedHistory: (controller, url, _) async {
              if (url == null) return;
              if (await _handleCallbackUrl(url) ||
                  await _handleExternalPaymentUrl(url)) {
                await controller.stopLoading();
              }
            },
            shouldInterceptRequest: (_, request) async {
              if (await _handleExternalPaymentUrl(request.url)) {
                return WebResourceResponse(
                  contentType: 'text/plain',
                  contentEncoding: 'utf-8',
                  data: Uint8List(0),
                );
              }
              return null;
            },
            onLoadResourceWithCustomScheme: (_, request) async {
              await _handleExternalPaymentUrl(request.url);
              return CustomSchemeResponse(
                contentType: 'text/plain',
                contentEncoding: 'utf-8',
                data: Uint8List(0),
              );
            },
            onReceivedError: (controller, request, _) async {
              if (await _handleExternalPaymentUrl(request.url) &&
                  await controller.canGoBack()) {
                await controller.goBack();
              }
            },
          ),
          if (_progress < 1)
            LinearProgressIndicator(
              value: _progress,
              color: SaaptTheme.primary,
              backgroundColor: const Color(0xFFE8ECF5),
            ),
          if (_confirming)
            const ColoredBox(
              color: Color(0x66000000),
              child: Center(
                child: Card(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 14),
                        Text('Confirming payment...'),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<bool> _handleCallbackUrl(WebUri url) async {
    final uri = Uri.tryParse(url.toString());
    if (uri == null || !uri.path.contains(_callbackPath)) return false;
    await _confirmPayment(retry: true);
    return true;
  }

  Future<bool> _handleExternalPaymentUrl(WebUri url) async {
    final uri = Uri.tryParse(url.toString());
    final scheme = uri?.scheme.toLowerCase() ?? '';
    if (!_externalPaymentSchemes.contains(scheme)) return false;

    final urlString = url.toString();
    final now = DateTime.now();
    if (_lastExternalUrl == urlString &&
        _lastExternalLaunchAt != null &&
        now.difference(_lastExternalLaunchAt!) < const Duration(seconds: 3)) {
      return true;
    }
    _lastExternalUrl = urlString;
    _lastExternalLaunchAt = now;

    try {
      final launched = Platform.isAndroid
          ? await _upiIntentChannel.invokeMethod<bool>('launch', {
                  'url': urlString,
                }) ??
                false
          : await launchUrl(uri!, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No supported UPI app was found.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(parentApiError(error, 'Unable to open UPI app')),
          ),
        );
      }
    }
    return true;
  }

  Future<void> _confirmPayment({required bool retry}) async {
    if (_confirming || _finished) return;
    if (mounted) setState(() => _confirming = true);
    try {
      final attempts = retry ? 5 : 1;
      for (var attempt = 0; attempt < attempts; attempt += 1) {
        final result = await ref
            .read(parentRepositoryProvider)
            .confirmFeePaymentLink(paymentLinkId: widget.paymentLinkId);
        if (result.paid) {
          _finished = true;
          if (mounted) Navigator.of(context).pop(true);
          return;
        }
        if (attempt + 1 < attempts) {
          await Future<void>.delayed(const Duration(seconds: 1));
        }
      }
      await _webViewController?.reload();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(parentApiError(error, 'Unable to confirm payment')),
          ),
        );
      }
    } finally {
      if (mounted && !_finished) setState(() => _confirming = false);
    }
  }
}
