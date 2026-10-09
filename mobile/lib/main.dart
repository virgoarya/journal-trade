import 'package:flutter/material.dart';

import 'features/auth/login_screen.dart';
import 'l10n/app_localizations.dart';
import 'theme/terminal_noir.dart';

void main() {
  runApp(const HunterTradesApp());
}

class HunterTradesApp extends StatelessWidget {
  const HunterTradesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: TerminalNoir.theme(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const LoginScreen(),
    );
  }
}
