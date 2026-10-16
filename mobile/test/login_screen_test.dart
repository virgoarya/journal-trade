import 'package:flutter_test/flutter_test.dart';
import 'package:hunter_trades_mobile/features/auth/login_screen.dart';
import 'package:hunter_trades_mobile/l10n/app_localizations.dart';
import 'package:hunter_trades_mobile/theme/terminal_noir.dart';
import 'package:flutter/material.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: TerminalNoir.theme(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  group('LoginScreen', () {
    testWidgets('renders brand, both fields and both actions', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      expect(find.text('HUNTER TRADES'), findsOneWidget);
      expect(find.text('USERNAME'), findsOneWidget);
      expect(find.text('PASSWORD'), findsOneWidget);
      expect(find.text('INITIALIZE SESSION'), findsOneWidget);
      expect(find.text('BIOMETRIC AUTH'), findsOneWidget);
    });

    testWidgets('empty submit shows the required-fields error', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      await tester.tap(find.text('INITIALIZE SESSION'));
      await tester.pump();

      expect(find.text('ACCESS DENIED — Fields required'), findsOneWidget);
    });

    testWidgets('wrong credentials show the invalid-credentials error',
        (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      await tester.enterText(find.byType(TextField).first, 'nope');
      await tester.enterText(find.byType(TextField).last, 'wrong');
      await tester.tap(find.text('INITIALIZE SESSION'));
      await tester.pump(const Duration(milliseconds: 800));
      await tester.pumpAndSettle();

      expect(find.text('ACCESS DENIED — Invalid credentials'), findsOneWidget);
    });

    testWidgets('valid credentials clear the error', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      await tester.enterText(find.byType(TextField).first, 'admin');
      await tester.enterText(find.byType(TextField).last, 'hunter');
      await tester.tap(find.text('INITIALIZE SESSION'));
      await tester.pump(const Duration(milliseconds: 800));
      await tester.pumpAndSettle();

      expect(find.textContaining('ACCESS DENIED'), findsNothing);
    });

    testWidgets('password toggle flips field obscurity', (tester) async {
      await tester.pumpWidget(_wrap(const LoginScreen()));

      TextField pwd() => tester.widget<TextField>(find.byType(TextField).last);
      expect(pwd().obscureText, isTrue);

      await tester.tap(find.byIcon(Icons.visibility_off));
      await tester.pump();

      expect(pwd().obscureText, isFalse);
    });
  });
}
