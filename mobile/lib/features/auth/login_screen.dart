import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/terminal_noir.dart';

/// Login PoC — Terminal Noir.
///
/// Auth is mocked behind [onAuthenticate] so the screen stays presentation-only
/// and testable; the real API call swaps in without touching this widget.
/// Every user-facing string resolves through [AppLocalizations] — nothing is
/// hardcoded.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.onAuthenticate,
    this.onBiometric,
  });

  /// Returns null on success, or an error key on failure.
  final Future<String?> Function(String username, String password)?
      onAuthenticate;

  final Future<bool> Function()? onBiometric;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _usernameFocus = FocusNode();
  final _passwordFocus = FocusNode();

  bool _obscure = true;
  bool _busy = false;
  String? _errorKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _usernameFocus.requestFocus();
    });
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _usernameFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;

    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorKey = 'empty');
      return;
    }

    setState(() {
      _busy = true;
      _errorKey = null;
    });

    // PoC auth: stands in for the real API call.
    final handler = widget.onAuthenticate ?? _mockAuthenticate;
    final error = await handler(username, password);

    if (!mounted) return;
    setState(() {
      _busy = false;
      _errorKey = error;
    });
  }

  /// Mock: only `admin` / `hunter` passes. Replaced by the real endpoint.
  Future<String?> _mockAuthenticate(String username, String password) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (username == 'admin' && password == 'hunter') return null;
    return 'invalid';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TerminalNoir.voidBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: TerminalNoir.s6,
              vertical: TerminalNoir.s8,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _BrandHeader(),
                  const SizedBox(height: TerminalNoir.s8),
                  _LoginCard(
                    usernameController: _usernameController,
                    passwordController: _passwordController,
                    usernameFocus: _usernameFocus,
                    passwordFocus: _passwordFocus,
                    obscure: _obscure,
                    busy: _busy,
                    errorKey: _errorKey,
                    onToggleObscure: () => setState(() => _obscure = !_obscure),
                    onSubmit: _submit,
                    onBiometric: widget.onBiometric,
                  ),
                  const SizedBox(height: TerminalNoir.s6),
                  const _SystemStatusFooter(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Wordmark + version line.
class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.bolt, color: TerminalNoir.gold, size: 28),
            const SizedBox(width: TerminalNoir.s2),
            Text(
              l10n.brandName,
              style: const TextStyle(
                fontFamily: TerminalNoir.monoFamily,
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: TerminalNoir.gold,
                letterSpacing: 2,
              ),
            ),
          ],
        ),
        const SizedBox(height: TerminalNoir.s2),
        Text(
          l10n.brandVersion,
          style: const TextStyle(
            fontFamily: TerminalNoir.monoFamily,
            fontSize: 12,
            color: TerminalNoir.textMuted,
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.usernameController,
    required this.passwordController,
    required this.usernameFocus,
    required this.passwordFocus,
    required this.obscure,
    required this.busy,
    required this.errorKey,
    required this.onToggleObscure,
    required this.onSubmit,
    this.onBiometric,
  });

  final TextEditingController usernameController;
  final TextEditingController passwordController;
  final FocusNode usernameFocus;
  final FocusNode passwordFocus;
  final bool obscure;
  final bool busy;
  final String? errorKey;
  final VoidCallback onToggleObscure;
  final VoidCallback onSubmit;
  final Future<bool> Function()? onBiometric;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      decoration: BoxDecoration(
        color: TerminalNoir.surface,
        borderRadius: BorderRadius.circular(TerminalNoir.rLg),
        border: Border.all(color: TerminalNoir.hairline),
      ),
      padding: const EdgeInsets.all(TerminalNoir.s6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _TerminalBar(),
          const SizedBox(height: TerminalNoir.s6),

          _FieldLabel(l10n.labelUsername),
          const SizedBox(height: TerminalNoir.s1 + 2),
          TextField(
            controller: usernameController,
            focusNode: usernameFocus,
            enabled: !busy,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            style: const TextStyle(
              fontFamily: TerminalNoir.monoFamily,
              fontSize: 14,
              color: TerminalNoir.textPrimary,
            ),
            decoration: InputDecoration(hintText: l10n.hintUsername),
            onSubmitted: (_) => passwordFocus.requestFocus(),
          ),
          const SizedBox(height: TerminalNoir.s4),

          _FieldLabel(l10n.labelPassword),
          const SizedBox(height: TerminalNoir.s1 + 2),
          TextField(
            controller: passwordController,
            focusNode: passwordFocus,
            enabled: !busy,
            obscureText: obscure,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            style: const TextStyle(
              fontFamily: TerminalNoir.monoFamily,
              fontSize: 14,
              color: TerminalNoir.textPrimary,
            ),
            decoration: InputDecoration(
              hintText: l10n.hintPassword,
              suffixIcon: IconButton(
                icon: Icon(
                  obscure ? Icons.visibility_off : Icons.visibility,
                  size: 18,
                  color: TerminalNoir.textMuted,
                ),
                onPressed: onToggleObscure,
                tooltip: l10n.actionTogglePassword,
              ),
            ),
            onSubmitted: (_) => onSubmit(),
          ),

          if (errorKey != null) ...[
            const SizedBox(height: TerminalNoir.s4),
            _ErrorBanner(messageKey: errorKey!),
          ],

          const SizedBox(height: TerminalNoir.s5),
          _PrimaryButton(busy: busy, onPressed: onSubmit),

          const SizedBox(height: TerminalNoir.s5),
          const _OrDivider(),
          const SizedBox(height: TerminalNoir.s5),

          _BiometricButton(onPressed: onBiometric),
        ],
      ),
    );
  }
}

/// Three dots + a blinking label — the terminal chrome.
class _TerminalBar extends StatelessWidget {
  const _TerminalBar();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.only(bottom: TerminalNoir.s3),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: TerminalNoir.hairline)),
      ),
      child: Row(
        children: [
          _dot(TerminalNoir.neonRed),
          const SizedBox(width: TerminalNoir.s2 - 2),
          _dot(TerminalNoir.neonOrange),
          const SizedBox(width: TerminalNoir.s2 - 2),
          _dot(TerminalNoir.neonGreen),
          const SizedBox(width: TerminalNoir.s3),
          Text(
            l10n.terminalAuthLabel,
            style: const TextStyle(
              fontFamily: TerminalNoir.monoFamily,
              fontSize: 11,
              color: TerminalNoir.textMuted,
            ),
          ),
          const SizedBox(width: TerminalNoir.s1),
          const _BlinkingCursor(),
        ],
      ),
    );
  }

  Widget _dot(Color c) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.6),
          shape: BoxShape.circle,
        ),
      );
}

class _BlinkingCursor extends StatefulWidget {
  const _BlinkingCursor();

  @override
  State<_BlinkingCursor> createState() => _BlinkingCursorState();
}

class _BlinkingCursorState extends State<_BlinkingCursor>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Respect the OS "reduce motion" setting — UI_UX_REVIEW.md §2.
    // Static cursor instead of a blink when animations are disabled.
    if (MediaQuery.disableAnimationsOf(context)) {
      return const Text(
        '_',
        style: TextStyle(
          fontFamily: TerminalNoir.monoFamily,
          fontSize: 11,
          color: TerminalNoir.gold,
        ),
      );
    }

    return FadeTransition(
      opacity: _controller.drive(
        TweenSequence<double>([
          TweenSequenceItem(tween: ConstantTween(1.0), weight: 50),
          TweenSequenceItem(tween: ConstantTween(0.0), weight: 50),
        ]),
      ),
      child: const Text(
        '_',
        style: TextStyle(
          fontFamily: TerminalNoir.monoFamily,
          fontSize: 11,
          color: TerminalNoir.gold,
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: TerminalNoir.monoFamily,
        fontSize: 11,
        color: TerminalNoir.textMuted,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.messageKey});
  final String messageKey;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final message = messageKey == 'empty'
        ? l10n.errorEmptyFields
        : l10n.errorInvalidCredentials;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: TerminalNoir.s3,
        vertical: TerminalNoir.s2,
      ),
      decoration: BoxDecoration(
        color: TerminalNoir.neonRed.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(TerminalNoir.rSm),
        border: Border.all(color: TerminalNoir.neonRed.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 14, color: TerminalNoir.neonRed),
          const SizedBox(width: TerminalNoir.s2),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontFamily: TerminalNoir.monoFamily,
                fontSize: 12,
                color: TerminalNoir.neonRed,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({required this.busy, required this.onPressed});

  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      height: 46,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: TerminalNoir.goldGlow,
          foregroundColor: TerminalNoir.gold,
          disabledBackgroundColor: TerminalNoir.goldGlow,
          disabledForegroundColor: TerminalNoir.goldDim,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TerminalNoir.rSm),
            side: BorderSide(
              color: TerminalNoir.gold.withValues(alpha: busy ? 0.2 : 0.3),
            ),
          ),
        ),
        child: busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(TerminalNoir.gold),
                ),
              )
            : Text(
                l10n.actionInitialize,
                style: const TextStyle(
                  fontFamily: TerminalNoir.monoFamily,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        const Expanded(
          child: Divider(color: TerminalNoir.hairline, height: 1),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: TerminalNoir.s3),
          child: Text(
            l10n.dividerOr,
            style: const TextStyle(
              fontFamily: TerminalNoir.monoFamily,
              fontSize: 11,
              color: Color(0x8094A3B8),
            ),
          ),
        ),
        const Expanded(
          child: Divider(color: TerminalNoir.hairline, height: 1),
        ),
      ],
    );
  }
}

class _BiometricButton extends StatelessWidget {
  const _BiometricButton({this.onPressed});
  final Future<bool> Function()? onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      height: 46,
      child: OutlinedButton.icon(
        onPressed: onPressed == null ? null : () => onPressed!(),
        icon: const Icon(Icons.fingerprint, size: 18),
        label: Text(
          l10n.actionBiometric,
          style: const TextStyle(
            fontFamily: TerminalNoir.monoFamily,
            fontSize: 13,
            letterSpacing: 1,
          ),
        ),
        style: OutlinedButton.styleFrom(
          backgroundColor: TerminalNoir.elevated,
          foregroundColor: TerminalNoir.textSecondary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TerminalNoir.rSm),
            side: const BorderSide(color: TerminalNoir.hairline),
          ),
        ),
      ),
    );
  }
}

class _SystemStatusFooter extends StatelessWidget {
  const _SystemStatusFooter();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('●', style: TextStyle(fontSize: 9, color: Color(0x8039FF88))),
        const SizedBox(width: TerminalNoir.s2),
        Text(
          l10n.statusOnline,
          style: const TextStyle(
            fontFamily: TerminalNoir.monoFamily,
            fontSize: 11,
            color: Color(0x6694A3B8),
            letterSpacing: 1,
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: TerminalNoir.s3),
          child: Text(
            '|',
            style: TextStyle(color: Color(0x1AFFFFFF), fontSize: 11),
          ),
        ),
        Text(
          l10n.statusEncrypted,
          style: const TextStyle(
            fontFamily: TerminalNoir.monoFamily,
            fontSize: 11,
            color: Color(0x6694A3B8),
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }
}
