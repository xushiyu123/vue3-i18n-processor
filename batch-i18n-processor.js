#!/usr/bin/env node

/**
 * 批量国际化处理脚本
 * 使用方法: node batch-i18n-processor.js <folder-path> [options]
 *
 * 参数:
 *   folder-path: 要处理的文件夹路径（相对路径）
 *
 * 选项:
 *   --template: 处理 Vue template 标签 (默认: true)
 *   --script: 处理 Vue script 标签 (默认: true)
 *   --ts: 处理 TypeScript 文件 (默认: true)
 *   --output: 国际化映射输出文件路径 (默认: ./<文件夹名>.json)
 *   --dry-run: 只显示结果，不修改文件 (默认: false)
 *
 * 示例:
 *   node batch-i18n-processor.js ./src/views              # 生成 views.json
 *   node batch-i18n-processor.js ./src/components         # 生成 components.json
 *   node batch-i18n-processor.js ./src --output ./locales/zh-CN.json --dry-run
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// 加载用户配置文件
let userConfig = {
  outputFile: './i18n-mapping.json',
  ignorePaths: ['node_modules', 'dist', '.git', '*.d.ts'],
  fileExtensions: ['.vue', '.ts', '.js'],
  vue: {
    importStatement: "import { useI18n } from 'vue-i18n';",
    instanceStatement: 'const { t } = useI18n();',
    i18nMethod: {
      template: '$t',
      script: 't',
    },
  },
  typescript: {
    importStatement: "import { i18n } from '@mgec/template/i18n/index.ts';",
    i18nMethod: 'i18n.global.t',
  },
  javascript: {
    importStatement: "import { i18n } from '@mgec/template/i18n/index.ts';",
    i18nMethod: 'i18n.global.t',
  },
};

const configPath = path.join(__dirname, 'i18n.config.js');
if (fs.existsSync(configPath)) {
  try {
    const loadedConfig = require(configPath);
    userConfig = { ...userConfig, ...loadedConfig };
    console.log('✓ 已加载配置文件: i18n.config.js');
  } catch (error) {
    console.warn('⚠ 加载配置文件失败，使用默认配置:', error.message);
  }
}

// 默认配置
const defaultConfig = {
  processVueTemplate: true,
  processVueScript: true,
  processTs: true,
  outputFile: userConfig.outputFile || './i18n-mapping.json',
  dryRun: false,
};

// 全局状态
let globalI18nMap = {};
let processedFiles = [];

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
使用方法: node batch-i18n-processor.js <folder-path> [options]

参数:
  folder-path: 要处理的文件夹路径（相对路径）

选项:
  --no-template: 不处理 Vue template 标签
  --no-script: 不处理 Vue script 标签  
  --no-ts: 不处理 TypeScript 文件
  --output <path>: 国际化映射输出文件路径 (默认: ./<文件夹名>.json)
  --dry-run: 只显示结果，不修改文件
  --help: 显示帮助信息

示例:
  node batch-i18n-processor.js ./src/views              # 生成 views.json
  node batch-i18n-processor.js ./src/components         # 生成 components.json
  node batch-i18n-processor.js ./src --output ./locales/zh-CN.json --dry-run
`);
    process.exit(0);
  }
  const config = { ...defaultConfig };
  config.folderPath = args[0];
  let hasCustomOutput = false;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--no-template':
        config.processVueTemplate = false;
        break;
      case '--no-script':
        config.processVueScript = false;
        break;
      case '--no-ts':
        config.processTs = false;
        break;
      case '--output':
        config.outputFile = args[++i];
        hasCustomOutput = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--help':
        console.log('显示帮助信息...');
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          console.error(`未知选项: ${arg}`);
          process.exit(1);
        }
    }
  }
  // 如果用户没有指定输出文件，根据文件夹名生成默认文件名
  if (!hasCustomOutput) {
    const folderName = path.basename(path.resolve(config.folderPath));
    config.outputFile = `./${folderName}.json`;
  }
  return config;
}

/**
 * 检查路径是否匹配忽略模式
 */
function shouldIgnorePath(filePath, ignorePaths) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(process.cwd(), filePath);
  for (const pattern of ignorePaths) {
    // 精确匹配文件名或目录名
    if (
      fileName === pattern ||
      filePath.includes(`${path.sep}${pattern}${path.sep}`) ||
      filePath.endsWith(`${path.sep}${pattern}`)
    ) {
      return true;
    }
    // 通配符匹配
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(regexPattern);
      if (regex.test(fileName) || regex.test(relativePath)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 递归获取所有需要处理的文件
 */
async function getAllFiles(dirPath, extensions = ['.vue', '.ts']) {
  const files = [];
  async function traverse(currentPath) {
    try {
      const items = await readdir(currentPath);
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const itemStat = await stat(itemPath);
        // 检查是否应该忽略
        if (shouldIgnorePath(itemPath, userConfig.ignorePaths)) {
          continue;
        }
        if (itemStat.isDirectory()) {
          await traverse(itemPath);
        } else if (itemStat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            files.push(itemPath);
          }
        }
      }
    } catch (error) {
      console.warn(`无法读取目录 ${currentPath}: ${error.message}`);
    }
  }
  await traverse(dirPath);
  return files;
}

/**
 * 移除注释
 */
function removeComments(text) {
  let result = text;
  // 移除单行注释 //
  result = result.replace(/\/\/.*$/gm, '');
  // 移除多行注释 /* */
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  // 移除HTML注释 <!-- -->
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  // 移除Python/Shell注释 #
  result = result.replace(/^[ \t]*#.*$/gm, '');
  return result;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 生成国际化 key
 */
function generateI18nKey(text) {
  // 直接使用原始文本作为key，相同文本使用相同key
  return text;
}

/**
 * 判断文本是否包含JavaScript表达式（不仅仅是纯文本）
 */
function containsJSExpression(text) {
  const jsPatterns = [
    /\?.*:/, // 三元表达式
    /[!=]==/, // 比较运算符
    /[!<>]=/, // 比较运算符
    /&&|\|\|/, // 逻辑运算符
    /['"][^\'"]*['"]/, // 包含内层引号
  ];
  return jsPatterns.some((pattern) => pattern.test(text));
}

/**
 * 判断文本是否包含代码特征（简化版）
 */
function isCodeLike(text) {
  const codePatterns = [
    /\b(function|const|let|var|if|else|for|while|return|await|async|import|export)\b/,
    /[{}();]/,
    /=>/,
    /\w+\s*\(/,
    /\w+\s*=/,
    /\w+\.[a-zA-Z]/,
    /ElMessage\./,
    /console\./,
  ];
  return codePatterns.some((pattern) => pattern.test(text));
}

/**
 * 检测文本是否已经被国际化处理
 */
function isAlreadyInternationalized(text, surroundingText = '', offsetInSurrounding = -1) {
  // 如果文本本身就包含国际化调用，则认为已经被处理
  const i18nPatterns = [
    /\$t\s*\(/, // $t(
    /\bt\s*\(/, // t(
    /i18n\.t\s*\(/, // i18n.t(
    /i18n\.global\.t\s*\(/, // i18n.global.t(
  ];
  if (i18nPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }
  // 更准确的检测逻辑：检查周围文本中的具体模式
  if (surroundingText) {
    const quotedText = `'${text}'`;
    // 如果提供了精确的偏移位置，直接使用
    if (offsetInSurrounding >= 0) {
      const textIndex = offsetInSurrounding;
      const beforeQuote = surroundingText.substring(Math.max(0, textIndex - 25), textIndex);
      // 检查是否直接在国际化调用中（紧邻引号前）
      const directI18nPatterns = [
        /\$t\s*\(\s*$/, // $t(
        /\bt\s*\(\s*$/, // t(
        /i18n\.t\s*\(\s*$/, // i18n.t(
        /i18n\.global\.t\s*\(\s*$/, // i18n.global.t(
        /\{\{\s*\$t\s*\(\s*$/, // {{ $t(
        /:[\w-]+\s*=\s*["`]?\s*\$t\s*\(\s*$/, // :attr="$t(
      ];
      return directI18nPatterns.some((pattern) => pattern.test(beforeQuote));
    }
    // 否则搜索所有可能的匹配位置
    let searchStart = 0;
    let textIndex;
    while ((textIndex = surroundingText.indexOf(quotedText, searchStart)) >= 0) {
      const beforeQuote = surroundingText.substring(Math.max(0, textIndex - 25), textIndex);
      const directI18nPatterns = [
        /\$t\s*\(\s*$/, // $t(
        /\bt\s*\(\s*$/, // t(
        /i18n\.t\s*\(\s*$/, // i18n.t(
        /i18n\.global\.t\s*\(\s*$/, // i18n.global.t(
        /\{\{\s*\$t\s*\(\s*$/, // {{ $t(
        /:[\w-]+\s*=\s*["`]?\s*\$t\s*\(\s*$/, // :attr="$t(
      ];
      if (directI18nPatterns.some((pattern) => pattern.test(beforeQuote))) {
        return true;
      }
      searchStart = textIndex + 1;
    }
  }
  return false;
}

/**
 * 从文本中提取中文词条
 */
function extractChineseTerms(text, context = 'script') {
  const terms = [];
  // 提取双引号内容
  const doubleQuoteRegex = /"([^"]*)"/g;
  let match;
  while ((match = doubleQuoteRegex.exec(text)) !== null) {
    const content = match[1].trim();
    // 跳过外层引号：如果内容是完整的单引号字符串，只处理内层
    if (content.startsWith("'") && content.endsWith("'")) {
      continue;
    }
    // 跳过包含JavaScript表达式的外层引号
    if (containsJSExpression(content)) {
      continue;
    }
    const startPos = Math.max(0, match.index - 100);
    const endPos = Math.min(text.length, match.index + match[0].length + 100);
    const surroundingText = text.substring(startPos, endPos);
    if (
      content &&
      /[\u4e00-\u9fa5]/.test(content) &&
      !isCodeLike(content) &&
      !isAlreadyInternationalized(content, surroundingText)
    ) {
      terms.push({ original: match[0], content, type: 'double-quote' });
    }
  }
  // 特别处理：直接匹配 i18n: '...' 格式（常见于timezone.ts等配置文件）
  const i18nFieldRegex = /i18n:\s*'([^']+)'/g;
  while ((match = i18nFieldRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content && /[\u4e00-\u9fa5]/.test(content) && !isCodeLike(content)) {
      terms.push({ original: match[0], content, type: 'i18n-field' });
    }
  }
  // 提取单引号内容（用于其他场景）
  const singleQuoteRegex = /'([^']*)'/g;
  while ((match = singleQuoteRegex.exec(text)) !== null) {
    const content = match[1].trim();
    // 跳过已经通过 i18n: 格式提取的内容
    const alreadyExtracted = terms.some((t) => t.content === content && t.type === 'i18n-field');
    if (alreadyExtracted) continue;
    // 跳过外层引号：如果内容是完整的双引号字符串，只处理内层
    if (content.startsWith('"') && content.endsWith('"')) {
      continue;
    }
    const startPos = Math.max(0, match.index - 100);
    const endPos = Math.min(text.length, match.index + match[0].length + 100);
    const surroundingText = text.substring(startPos, endPos);
    // 计算当前匹配在surroundingText中的偏移位置
    // match.index是在完整text中的位置，startPos是surroundingText的起始位置
    // 所以在surroundingText中，引号的位置是 match.index - startPos
    const offsetInSurrounding = match.index - startPos;
    if (
      content &&
      /[\u4e00-\u9fa5]/.test(content) &&
      !isCodeLike(content) &&
      !isAlreadyInternationalized(content, surroundingText, offsetInSurrounding)
    ) {
      terms.push({ original: match[0], content, type: 'single-quote' });
    }
  }
  // 提取模板字符串（反引号）- 支持script和template上下文
  const templateRegex = /`([^`]*)`/g;
  while ((match = templateRegex.exec(text)) !== null) {
    const content = match[1].trim();
    const startPos = Math.max(0, match.index - 50);
    const endPos = Math.min(text.length, match.index + match[0].length + 50);
    const surroundingText = text.substring(startPos, endPos);
    if (
      content &&
      /[\u4e00-\u9fa5]/.test(content) &&
      !isAlreadyInternationalized(match[0], surroundingText)
    ) {
      terms.push({ original: match[0], content, type: 'template' });
    }
  }
  // 提取标签间内容（仅限 template）
  if (context === 'template') {
    // 提取标签间的纯文本内容（支持跨行）
    const tagContentRegex = />([^<>]*?)</gs;
    while ((match = tagContentRegex.exec(text)) !== null) {
      const content = match[1].trim();
      if (
        content &&
        /[\u4e00-\u9fa5]/.test(content) &&
        !content.includes('"') &&
        !content.includes("'") &&
        !content.includes('{{') &&
        !content.includes('}}') &&
        !isCodeLike(content)
      ) {
        const startPos = Math.max(0, match.index - 50);
        const endPos = Math.min(text.length, match.index + match[0].length + 50);
        const surroundingText = text.substring(startPos, endPos);
        if (!isAlreadyInternationalized(match[0], surroundingText)) {
          terms.push({ original: `>${match[1]}<`, content, type: 'tag-content' });
        }
      }
    }
    // 提取按钮、链接等标签中的纯中文文本（支持跨行和多行空白）
    const buttonTextRegex =
      /<(el-button|el-radio-button|button|a)([^>]*)>([\s\S]*?)<\/(el-button|el-radio-button|button|a)>/g;
    while ((match = buttonTextRegex.exec(text)) !== null) {
      const content = match[3].trim();
      if (
        content &&
        /[\u4e00-\u9fa5]/.test(content) &&
        !content.includes('{{') &&
        !content.includes('}}') &&
        !isCodeLike(content)
      ) {
        const startPos = Math.max(0, match.index - 50);
        const endPos = Math.min(text.length, match.index + match[0].length + 50);
        const surroundingText = text.substring(startPos, endPos);
        if (!isAlreadyInternationalized(match[0], surroundingText)) {
          terms.push({
            original: match[0],
            content,
            type: 'button-text',
            tagName: match[1],
            attrs: match[2],
          });
        }
      }
    }
  }
  return terms;
}

/**
 * 只替换第一个匹配项
 */
function replaceFirst(text, search, replacement) {
  const index = text.indexOf(search);
  if (index === -1) {
    return text;
  }
  return text.substring(0, index) + replacement + text.substring(index + search.length);
}

/**
 * 处理引号包围的字符串（只替换第一个）
 */
function processQuotedStringOnce(templateContent, term, key) {
  // 检查是否在HTML属性中
  const attrCheck = checkIfInAttribute(templateContent, term.original);
  if (attrCheck.isAttribute) {
    if (attrCheck.needsBinding) {
      // 基本HTML属性：添加Vue绑定
      const attrPattern = `${attrCheck.attrName}=${term.original}`;
      return replaceFirst(templateContent, attrPattern, `:${attrCheck.attrName}="$t('${key}')"`);
    } else {
      // 已有Vue绑定：直接替换字符串内容
      return replaceFirst(templateContent, term.original, `$t('${key}')`);
    }
  }
  // 检查是否在Vue绑定属性的JavaScript表达式中
  const textIndex = templateContent.indexOf(term.original);
  if (isInVueBindingExpression(templateContent, textIndex)) {
    return replaceFirst(templateContent, term.original, `$t('${key}')`);
  }
  // 默认情况：使用Vue插值语法
  return replaceFirst(templateContent, term.original, `{{ $t('${key}') }}`);
}

/**
 * 检查字符串是否在HTML属性中
 */
function checkIfInAttribute(templateContent, original) {
  // 检查是否在基本HTML属性中（如 label="text"）
  const basicAttrRegex = new RegExp(`([\\w-]+)\\s*=\\s*${escapeRegExp(original)}`, 'g');
  const basicMatch = basicAttrRegex.exec(templateContent);
  if (basicMatch) {
    return {
      isAttribute: true,
      needsBinding: true,
      attrName: basicMatch[1],
    };
  }
  // 检查是否在Vue绑定属性中（如 :label="text"）
  const vueAttrRegex = new RegExp(
    `:([\\w-]+)\\s*=\\s*["'][^"']*${escapeRegExp(original.replace(/['"]/g, ''))}[^"']*["']`,
    'g'
  );
  const vueMatch = vueAttrRegex.exec(templateContent);
  if (vueMatch) {
    return {
      isAttribute: true,
      needsBinding: false,
      attrName: vueMatch[1],
    };
  }
  return { isAttribute: false };
}

/**
 * 检查文本是否在Vue插值表达式 {{ }} 内部
 */
function isInVueInterpolation(templateContent, textIndex) {
  if (textIndex < 0) return false;
  const beforeText = templateContent.substring(0, textIndex);
  // 查找最近的 {{ 和 }}
  const lastOpenBrace = beforeText.lastIndexOf('{{');
  const lastCloseBrace = beforeText.lastIndexOf('}}');
  // 如果找到了 {{，并且它在最后一个 }} 之后（或没有 }}），说明在插值表达式内部
  if (lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace) {
    // 检查从 {{ 到当前位置之间是否有闭合的 }}
    const afterOpen = templateContent.substring(lastOpenBrace + 2, textIndex);
    if (!afterOpen.includes('}}')) {
      return true;
    }
  }
  return false;
}

/**
 * 检查字符串是否在Vue绑定属性的JavaScript表达式中
 */
function isInVueBindingExpression(templateContent, textIndex) {
  if (textIndex < 0) return false;
  const beforeText = templateContent.substring(0, textIndex);
  // 向前查找最近的可能的属性开始位置
  // 匹配 :attr=" 或 v-attr=" 或 @attr="
  const vueBindingRegex = /(?:^|[>\s])(:|@|v-)[\w-]+\s*=\s*["']/g;
  let lastBindingMatch = null;
  let match;
  while ((match = vueBindingRegex.exec(beforeText)) !== null) {
    lastBindingMatch = match;
  }
  if (!lastBindingMatch) {
    return false;
  }
  // 获取属性开始的引号
  const attrStartIndex = lastBindingMatch.index + lastBindingMatch[0].length - 1;
  const openingQuote = beforeText[attrStartIndex];
  // 从属性开始位置到文本位置，查找是否有闭合引号
  const betweenText = templateContent.substring(attrStartIndex + 1, textIndex);
  // 简单检查：如果之间没有同类型的引号，说明属性未闭合，文本在属性内部
  if (!betweenText.includes(openingQuote)) {
    return true;
  }
  // 如果有引号，需要更仔细地判断（考虑嵌套的引号）
  // 计算引号的配对情况
  let quoteCount = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (let i = 0; i < betweenText.length; i++) {
    const char = betweenText[i];
    const prevChar = i > 0 ? betweenText[i - 1] : '';
    // 跳过转义的引号
    if (prevChar === '\\') continue;
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      if (!inDoubleQuote && openingQuote === '"') quoteCount++;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      if (!inSingleQuote && openingQuote === "'") quoteCount++;
    }
  }
  // 如果配对的引号数量为0，说明属性未闭合
  return quoteCount === 0;
}

/**
 * 处理引号包围的字符串
 */
function processQuotedString(templateContent, term, key) {
  // 检查是否在HTML属性中
  const attrCheck = checkIfInAttribute(templateContent, term.original);
  if (attrCheck.isAttribute) {
    if (attrCheck.needsBinding) {
      // 基本HTML属性：添加Vue绑定
      return templateContent.replace(
        new RegExp(`${escapeRegExp(attrCheck.attrName)}\\s*=\\s*${escapeRegExp(term.original)}`),
        `:${attrCheck.attrName}="$t('${key}')"`
      );
    } else {
      // 已有Vue绑定：直接替换字符串内容
      return templateContent.replace(term.original, `$t('${key}')`);
    }
  }
  // 检查是否在Vue绑定属性的JavaScript表达式中
  const textIndex = templateContent.indexOf(term.original);
  if (isInVueBindingExpression(templateContent, textIndex)) {
    return templateContent.replace(term.original, `$t('${key}')`);
  }
  // 默认情况：使用Vue插值语法
  return templateContent.replace(term.original, `{{ $t('${key}') }}`);
}

/**
 * 转换模板字符串为 i18n 语法
 */
function convertTemplateToI18n(templateString, methodPrefix = '$t') {
  const variableRegex = /\$\{([^}]+)\}/g;
  const variables = [];
  let match;
  while ((match = variableRegex.exec(templateString)) !== null) {
    variables.push(match[1]);
  }
  let convertedText = templateString;
  const mapping = {};
  variables.forEach((variable, index) => {
    const newVarName = String.fromCharCode(97 + index); // a, b, c...
    mapping[newVarName] = variable;
    convertedText = convertedText.replace(
      new RegExp(`\\$\\{${escapeRegExp(variable)}\\}`, 'g'),
      `{${newVarName}}`
    );
  });
  // 直接使用转换后的文本作为key（包含{a},{b}等占位符）
  globalI18nMap[convertedText] = convertedText;
  const mappingString = Object.entries(mapping)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  const i18nCall = mappingString
    ? `${methodPrefix}('${convertedText}', {${mappingString}})`
    : `${methodPrefix}('${convertedText}')`;
  return {
    key: convertedText,
    converted: i18nCall,
    replacedText: convertedText,
    mapping,
  };
}

/**
 * 处理 Vue 文件
 */
async function processVueFile(filePath, config) {
  const originalContent = await readFile(filePath, 'utf-8');
  let modifiedContent = originalContent;
  let extractedCount = 0;
  console.log(`处理 Vue 文件: ${filePath}`);
  // 分离 template 和 script 部分
  // 提取最外层的template标签内容（使用贪婪匹配）
  const templateMatch = modifiedContent.match(/<template[^>]*>([\s\S]*)<\/template>/i);
  const scriptMatch = modifiedContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  // 处理 template 部分
  if (templateMatch && config.processVueTemplate) {
    const templateContent = templateMatch[1];
    const cleanTemplate = removeComments(templateContent);
    const terms = extractChineseTerms(cleanTemplate, 'template');
    let newTemplateContent = templateContent;
    // 使用Set去重，避免重复处理相同的原始文本
    const processedOriginals = new Set();
    for (const term of terms) {
      // 跳过已经处理过的相同原始文本
      if (processedOriginals.has(term.original)) {
        continue;
      }
      processedOriginals.add(term.original);
      // 检查这个原始文本是否还存在
      const textIndex = newTemplateContent.indexOf(term.original);
      if (textIndex === -1) {
        // 原始文本已经不存在（可能已被替换），跳过
        continue;
      }
      const hasTemplate = /\$\{.*?\}/.test(term.content);
      const templateMethod = userConfig.vue.i18nMethod.template;
      if (hasTemplate) {
        // 处理模板字符串
        const converted = convertTemplateToI18n(term.content, templateMethod);
        const key = converted.replacedText; // 使用处理后的文本作为key
        globalI18nMap[key] = converted.replacedText; // 使用处理后的文本作为value
        // 统一检查上下文，无论是否为反引号模板字符串
        if (term.type === 'button-text') {
          // 按钮中的模板字符串
          const newContent = `<${term.tagName}${term.attrs}>{{ ${converted.converted} }}</${term.tagName}>`;
          newTemplateContent = replaceFirst(newTemplateContent, term.original, newContent);
        } else {
          // 检查是否在HTML属性中
          const isInAttribute = checkIfInAttribute(newTemplateContent, term.original);
          if (isInAttribute.isAttribute) {
            // 在属性中：根据情况添加Vue绑定
            if (isInAttribute.needsBinding) {
              newTemplateContent = replaceFirst(
                newTemplateContent,
                `${isInAttribute.attrName}=${term.original}`,
                `:${isInAttribute.attrName}="${converted.converted}"`
              );
            } else {
              // 已经有Vue绑定，直接替换内容（不保留反引号）
              newTemplateContent = replaceFirst(
                newTemplateContent,
                term.original,
                converted.converted
              );
            }
          } else {
            // 检查是否在Vue插值表达式内部
            const textIndex = newTemplateContent.indexOf(term.original);
            if (textIndex !== -1 && isInVueInterpolation(newTemplateContent, textIndex)) {
              // 在Vue插值表达式内部：直接替换
              newTemplateContent = replaceFirst(
                newTemplateContent,
                term.original,
                converted.converted
              );
            } else {
              // 不在属性中：使用Vue插值
              newTemplateContent = replaceFirst(
                newTemplateContent,
                term.original,
                `{{ ${converted.converted} }}`
              );
            }
          }
        }
      } else {
        // 普通文本处理
        const key = generateI18nKey(term.content);
        globalI18nMap[key] = term.content;
        if (term.type === 'tag-content') {
          // 全局替换所有标签内容
          const escapedOriginal = escapeRegExp(term.original);
          newTemplateContent = newTemplateContent.replace(
            new RegExp(escapedOriginal, 'g'),
            `>{{ ${templateMethod}('${key}') }}<`
          );
        } else if (term.type === 'button-text') {
          // 按钮文本全局替换
          const escapedOriginal = escapeRegExp(term.original);
          const newContent = `<${term.tagName}${term.attrs}>{{ ${templateMethod}('${key}') }}</${term.tagName}>`;
          newTemplateContent = newTemplateContent.replace(
            new RegExp(escapedOriginal, 'g'),
            newContent
          );
        } else if (term.type === 'double-quote' || term.type === 'single-quote') {
          // 引号字符串：需要根据上下文处理每个匹配项
          const escapedOriginal = escapeRegExp(term.original);
          const regex = new RegExp(escapedOriginal, 'g');
          let match;
          const replacements = [];
          // 找到所有匹配位置
          while ((match = regex.exec(newTemplateContent)) !== null) {
            replacements.push({
              index: match.index,
              original: match[0],
            });
          }
          // 从后往前替换，避免索引变化
          for (let i = replacements.length - 1; i >= 0; i--) {
            const { index, original } = replacements[i];
            const before = newTemplateContent.substring(0, index);
            const after = newTemplateContent.substring(index + original.length);
            // 检查是否在基本HTML属性中（没有冒号或v-前缀的属性）
            const attrMatch = before.match(/(?:^|[>\s])([\w-]+)\s*=\s*$/);
            const vueBindingMatch = before.match(/(?:^|[>\s])(?::|v-)[\w-]+\s*=\s*$/);
            if (attrMatch && !vueBindingMatch) {
              // 在基本HTML属性中：使用 :attr="$t(...)" 格式
              const attrName = attrMatch[1];
              const beforeAttr = before.substring(0, before.length - attrMatch[0].length);
              newTemplateContent =
                beforeAttr + `:${attrName}="${templateMethod}('${key}')"` + after;
            } else if (
              isInVueInterpolation(before + original, before.length + original.length - 1)
            ) {
              // 在Vue插值表达式 {{ }} 内部：直接使用 $t(...)
              newTemplateContent = before + `${templateMethod}('${key}')` + after;
            } else if (
              isInVueBindingExpression(before + original, before.length + original.length - 1)
            ) {
              // 在Vue绑定表达式中：直接使用 $t(...)
              newTemplateContent = before + `${templateMethod}('${key}')` + after;
            } else {
              // 默认：使用 {{ $t(...) }}
              newTemplateContent = before + `{{ ${templateMethod}('${key}') }}` + after;
            }
          }
        } else {
          newTemplateContent = replaceFirst(
            newTemplateContent,
            term.original,
            `{{ ${templateMethod}('${key}') }}`
          );
        }
      }
      extractedCount++;
    }
    modifiedContent = modifiedContent.replace(templateContent, newTemplateContent);
  }

  // 处理 script 部分
  if (scriptMatch && config.processVueScript) {
    const scriptContent = scriptMatch[1];
    const cleanScript = removeComments(scriptContent);
    // 先提取词条，检查是否有需要处理的内容
    const termsPreCheck = extractChineseTerms(cleanScript, 'script');
    // 只过滤掉 import 语句
    const validTerms = termsPreCheck.filter((term) => !term.content.includes('import'));
    // 如果script有需要处理的词条，才添加导入和处理
    if (validTerms.length > 0) {
      // 检查是否已有 useI18n 导入
      const hasUseI18n =
        /import.*useI18n.*from.*vue-i18n/.test(cleanScript) ||
        /const.*\{.*t.*\}.*useI18n/.test(cleanScript);
      let newScriptContent = scriptContent;
      // 添加 import 和 useI18n（如果需要）
      if (!hasUseI18n) {
        const importRegex = /^(\s*)(import.*?\n)*/m;
        const importMatch = newScriptContent.match(importRegex);
        const newImport = userConfig.vue.importStatement + '\n';
        if (importMatch) {
          const importSection = importMatch[0];
          newScriptContent = newScriptContent.replace(importSection, importSection + newImport);
        } else {
          newScriptContent = newImport + newScriptContent;
        }
        // 添加 useI18n 声明 - 在所有 import 语句之后
        const useI18nDeclaration = userConfig.vue.instanceStatement + '\n\n';
        // 找到最后一个import语句的位置
        const importLines = newScriptContent.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < importLines.length; i++) {
          const line = importLines[i].trim();
          if (line.startsWith('import ') && !line.includes('//')) {
            lastImportIndex = i;
          }
        }
        if (lastImportIndex >= 0) {
          // 在最后一个import语句之后插入
          importLines.splice(lastImportIndex + 1, 0, '', userConfig.vue.instanceStatement);
          newScriptContent = importLines.join('\n');
        } else {
          // 如果找不到import，就在开头添加
          newScriptContent = useI18nDeclaration + newScriptContent;
        }
      }
      // 基于修改后的内容提取词条（确保上下文一致）
      const cleanNewScript = removeComments(newScriptContent);
      const terms = extractChineseTerms(cleanNewScript, 'script');
      // 使用Set去重，避免重复处理相同的文本
      const processedTexts = new Set();
      for (const term of terms) {
        // 只跳过 import 语句
        if (term.content.includes('import')) {
          continue;
        }
        // 跳过已经处理过的相同文本
        if (processedTexts.has(term.content)) {
          continue;
        }
        processedTexts.add(term.content);
        const hasTemplate = /\$\{.*?\}/.test(term.content);
        if (hasTemplate) {
          // 处理模板字符串
          const converted = convertTemplateToI18n(term.content, userConfig.vue.i18nMethod.script);
          const key = converted.replacedText; // 使用处理后的文本作为key
          globalI18nMap[key] = converted.replacedText; // 使用处理后的文本作为value
          if (term.type === 'template') {
            // 模板字符串：只替换第一个匹配项
            newScriptContent = newScriptContent.replace(term.original, converted.converted);
          } else {
            // 普通字符串中包含模板语法：只替换第一个匹配项
            newScriptContent = newScriptContent.replace(term.original, converted.converted);
          }
        } else {
          // 普通文本：使用全局替换，确保同样的文本使用相同的key
          const key = generateI18nKey(term.content);
          globalI18nMap[key] = term.content;
          const escapedOriginal = escapeRegExp(term.original);
          newScriptContent = newScriptContent.replace(
            new RegExp(escapedOriginal, 'g'),
            `${userConfig.vue.i18nMethod.script}('${key}')`
          );
        }
        extractedCount++;
      }
      modifiedContent = modifiedContent.replace(scriptContent, newScriptContent);
    } // 结束 if (validTerms.length > 0)
  }
  return { modifiedContent, extractedCount };
}

/**
 * 处理 TypeScript 文件
 */
async function processTsFile(filePath, config) {
  const originalContent = await readFile(filePath, 'utf-8');
  const cleanContent = removeComments(originalContent);
  console.log(`处理 TS 文件: ${filePath}`);
  // 先提取词条，检查是否有需要处理的内容
  const termsPreCheck = extractChineseTerms(cleanContent, 'script');
  // 只过滤掉 import 语句，不要过滤包含 i18n 的普通文本
  const validTerms = termsPreCheck.filter((term) => !term.content.includes('import'));
  // 如果没有需要处理的词条，跳过处理
  if (validTerms.length === 0) {
    return { modifiedContent: originalContent, extractedCount: 0 };
  }
  // 检查是否已有 i18n 导入
  const hasI18nImport = /import.*i18n.*from/.test(cleanContent);
  let modifiedContent = originalContent;
  let extractedCount = 0;
  // 获取文件扩展名，确定使用哪个配置
  const ext = path.extname(filePath);
  const i18nConfig = ext === '.js' ? userConfig.javascript : userConfig.typescript;
  // 添加 import（如果需要）
  if (!hasI18nImport) {
    const importRegex = /^(\s*)(import.*?\n)*/m;
    const importMatch = modifiedContent.match(importRegex);
    const newImport = i18nConfig.importStatement + '\n';
    if (importMatch) {
      const importSection = importMatch[0];
      modifiedContent = modifiedContent.replace(importSection, importSection + newImport);
    } else {
      modifiedContent = newImport + modifiedContent;
    }
  }
  const terms = extractChineseTerms(cleanContent, 'script');
  // 使用Set去重，避免重复处理相同的文本
  const processedTexts = new Set();
  for (const term of terms) {
    // 只跳过 import 语句，不要跳过包含 i18n 的普通文本
    if (term.content.includes('import')) {
      continue;
    }
    // 跳过已经处理过的相同文本
    if (processedTexts.has(term.content)) {
      continue;
    }
    processedTexts.add(term.content);
    const hasTemplate = /\$\{.*?\}/.test(term.content);
    if (hasTemplate) {
      // 处理模板字符串：只替换第一个匹配项
      const converted = convertTemplateToI18n(term.content, i18nConfig.i18nMethod);
      const key = converted.replacedText; // 使用处理后的文本作为key
      globalI18nMap[key] = converted.replacedText; // 使用处理后的文本作为value
      let replacement = converted.converted;
      // 对于 i18n-field 类型，需要保留 i18n: 前缀
      if (term.type === 'i18n-field') {
        replacement = `i18n: ${replacement}`;
      }
      modifiedContent = modifiedContent.replace(term.original, replacement);
    } else {
      // 普通文本：使用全局替换，确保同样的文本使用相同的key
      const key = generateI18nKey(term.content);
      globalI18nMap[key] = term.content;
      const escapedOriginal = escapeRegExp(term.original);
      let replacement = `${i18nConfig.i18nMethod}('${key}')`;
      // 对于 i18n-field 类型，需要保留 i18n: 前缀
      if (term.type === 'i18n-field') {
        replacement = `i18n: ${replacement}`;
      }
      modifiedContent = modifiedContent.replace(new RegExp(escapedOriginal, 'g'), replacement);
    }
    extractedCount++;
  }
  return { modifiedContent, extractedCount };
}

/**
 * 处理单个文件
 */
async function processFile(filePath, config) {
  const ext = path.extname(filePath);
  const relativePath = path.relative(process.cwd(), filePath);
  try {
    let result;
    if (ext === '.vue') {
      result = await processVueFile(filePath, config);
    } else if (ext === '.ts') {
      if (!config.processTs) {
        return { success: true, message: '跳过TS文件', extractedCount: 0 };
      }
      result = await processTsFile(filePath, config);
    } else {
      return { success: true, message: '跳过不支持的文件类型', extractedCount: 0 };
    }
    // 写入修改后的文件（如果不是dry-run）
    if (!config.dryRun && result.modifiedContent) {
      await writeFile(filePath, result.modifiedContent, 'utf-8');
    }
    processedFiles.push({
      path: relativePath,
      extractedCount: result.extractedCount,
      success: true,
    });
    return {
      success: true,
      message: `处理成功`,
      extractedCount: result.extractedCount,
    };
  } catch (error) {
    console.error(`处理文件 ${relativePath} 时出错:`, error.message);
    processedFiles.push({
      path: relativePath,
      error: error.message,
      success: false,
    });
    return {
      success: false,
      message: `处理失败: ${error.message}`,
      extractedCount: 0,
    };
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const config = parseArgs();
    console.log('批量国际化处理开始...');
    console.log('配置:', {
      文件夹: config.folderPath,
      处理Vue模板: config.processVueTemplate,
      处理Vue脚本: config.processVueScript,
      处理TS文件: config.processTs,
      输出文件: config.outputFile,
      模拟运行: config.dryRun,
    });
    // 检查文件夹是否存在
    if (!fs.existsSync(config.folderPath)) {
      console.error(`错误: 文件夹 ${config.folderPath} 不存在`);
      process.exit(1);
    }
    // 获取所有需要处理的文件
    const files = await getAllFiles(config.folderPath, userConfig.fileExtensions);
    console.log(`\n找到 ${files.length} 个文件需要处理`);
    if (files.length === 0) {
      console.log('没有找到需要处理的文件');
      return;
    }
    // 逐个处理文件
    let totalExtracted = 0;
    let successCount = 0;
    for (const filePath of files) {
      const result = await processFile(filePath, config);
      if (result.success) {
        successCount++;
        totalExtracted += result.extractedCount;
        if (result.extractedCount > 0) {
          console.log(`✓ ${path.relative(process.cwd(), filePath)} (${result.extractedCount} 项)`);
        }
      } else {
        console.log(`✗ ${path.relative(process.cwd(), filePath)} - ${result.message}`);
      }
    }
    // 输出国际化映射文件
    if (Object.keys(globalI18nMap).length > 0) {
      const outputPath = path.resolve(config.outputFile);
      const jsonContent = JSON.stringify(globalI18nMap, null, 2);
      if (!config.dryRun) {
        await writeFile(outputPath, jsonContent, 'utf-8');
        console.log(`\n✓ 国际化映射已保存到: ${outputPath}`);
      } else {
        console.log(`\n[DRY-RUN] 将要保存国际化映射到: ${outputPath}`);
        console.log('前10项预览:');
        const entries = Object.entries(globalI18nMap).slice(0, 10);
        entries.forEach(([key, value]) => {
          console.log(`  "${key}": "${value}"`);
        });
      }
    }
    // 输出统计信息
    console.log('\n=== 处理完成 ===');
    console.log(`总计处理: ${files.length} 个文件`);
    console.log(`成功处理: ${successCount} 个文件`);
    console.log(`提取词条: ${totalExtracted} 项`);
    console.log(`生成映射: ${Object.keys(globalI18nMap).length} 项`);
    if (config.dryRun) {
      console.log('\n注意: 这是模拟运行，没有实际修改文件');
    }
  } catch (error) {
    console.error('批量处理失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  processFile,
  processVueFile,
  processTsFile,
  extractChineseTerms,
  convertTemplateToI18n,
  generateI18nKey,
  globalI18nMap,
  removeComments,
  checkIfInAttribute,
  processQuotedString,
  isAlreadyInternationalized,
  replaceFirst,
  processQuotedStringOnce,
  isInVueBindingExpression,
};
