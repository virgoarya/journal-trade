import { macroAiService } from './src/services/macro-ai.service';
macroAiService.analyzeMacroFeed('Dutch military invests millions in drone software platform', 'General').then(console.log).catch(console.error);
