# 📚 国际化处理脚本

一套强大的 Vue/TypeScript/JavaScript 国际化处理工具，自动提取中文文本并转换为 vue-i18n 调用格式。

A powerful internationalization (i18n) toolkit for Vue/TypeScript/JavaScript projects that automatically extracts Chinese text and converts it to vue-i18n call format.

---

## 📝 **处理场景**

### **Vue Template 部分**

#### **属性中的文本：**

```vue
<!-- 处理前 -->
<el-form-item label="模型类型">
<el-select placeholder="请选择模型类型">

<!-- 处理后 -->
<el-form-item :label="$t('模型类型')">
<el-select :placeholder="$t('请选择模型类型')">
```

#### **按钮文本：**

```vue
<!-- 处理前 -->
<el-button>查询</el-button>
<el-button>保存</el-button>

<!-- 处理后 -->
<el-button>{{ $t('查询') }}</el-button>
<el-button>{{ $t('保存') }}</el-button>
```

#### **标签间文本：**

```vue
<!-- 处理前 -->
<el-breadcrumb-item>表维护</el-breadcrumb-item>

<!-- 处理后 -->
<el-breadcrumb-item>{{ $t('表维护') }}</el-breadcrumb-item>
```

#### **模板字符串：**

```vue
<!-- 处理前 -->
<span>共${count}条记录</span>

<!-- 处理后 -->
<span>{{ $t('共{a}条记录', {a: count}) }}</span>
```

### **Vue Script 部分**

#### **自动导入和声明：**

```typescript
// 处理后自动添加
import { useI18n } from 'vue-i18n';

const { t } = useI18n(); // ✅ 现在会正确添加这行
```

#### **消息和文本处理：**

```typescript
// 处理前
ElMessage.success('修改域信息成功');
ElMessage.warning('请选择要同步的表');

// 处理后
ElMessage.success(t('修改域信息成功'));
ElMessage.warning(t('请选择要同步的表'));
```

#### **表单验证消息：**

```typescript
// 处理前
const formRules = {
  name: [{ required: true, message: '请输入域名', trigger: 'blur' }],
};

// 处理后
const formRules = {
  name: [{ required: true, message: t('请输入域名'), trigger: 'blur' }],
};
```

### **TypeScript 文件**

#### **自动导入：**

```typescript
// 处理后自动添加
import { i18n } from '@mgec/template/i18n/index.ts';
```

#### **文本处理：**

```typescript
// 处理前
return '用户名不能为空';

// 处理后
return i18n.t('用户名不能为空');
```

## 🎯 **生成的国际化映射**

处理完成后会生成 `i18n-mapping.json` 文件：

```json
{
  "模型类型": "模型类型",
  "请选择模型类型": "请选择模型类型",
  "查询": "查询",
  "保存": "保存",
  "表维护": "表维护",
  "修改域信息成功": "修改域信息成功",
  "请输入域名": "请输入域名",
  "共{a}条记录": "共{a}条记录"
}
```

## ⚙️ 配置文件

脚本支持通过 `i18n.config.js` 配置文件自定义处理行为。

### 配置文件示例

```javascript
// i18n.config.js
module.exports = {
  // 翻译词条 JSON 文件的存放路径
  outputFile: './i18n-mapping.json',

  // 忽略的文件夹路径（支持 * 通配符）
  ignorePaths: [
    'node_modules',
    'dist',
    '.git',
    '*.d.ts',
    '*.spec.ts',
    '*.test.ts',
    'test',
    'tests',
  ],

  // 要转换的文件类型
  fileExtensions: ['.vue', '.ts', '.js'],

  // Vue 文件配置
  vue: {
    // vue-i18n 引入语句
    importStatement: "import { useI18n } from 'vue-i18n';",
    // useI18n 实例声明语句
    instanceStatement: 'const { t } = useI18n();',
    // 国际化方法名
    i18nMethod: {
      template: '$t', // template 中使用 $t
      script: 't', // script 中使用 t
    },
  },

  // TypeScript 文件配置
  typescript: {
    // i18n 引入语句
    importStatement: "import { i18n } from '@mgec/template/i18n/index.ts';",
    // 国际化方法名
    i18nMethod: 'i18n.global.t',
  },

  // JavaScript 文件配置
  javascript: {
    importStatement: "import { i18n } from '@mgec/template/i18n/index.ts';",
    i18nMethod: 'i18n.global.t',
  },
};
```

### 配置项说明

| 配置项                       | 说明                              | 默认值                                                   |
| ---------------------------- | --------------------------------- | -------------------------------------------------------- |
| `outputFile`                 | 翻译词条 JSON 文件的存放路径      | `./i18n-mapping.json`                                    |
| `ignorePaths`                | 忽略的文件夹路径，支持 `*` 通配符 | `['node_modules', 'dist', '.git', '*.d.ts']`             |
| `fileExtensions`             | 要转换的文件类型                  | `['.vue', '.ts', '.js']`                                 |
| `vue.importStatement`        | Vue 文件的 i18n 引入语句          | `"import { useI18n } from 'vue-i18n';"`                  |
| `vue.instanceStatement`      | Vue 文件的 i18n 实例声明          | `"const { t } = useI18n();"`                             |
| `vue.i18nMethod.template`    | Vue template 中的国际化方法       | `$t`                                                     |
| `vue.i18nMethod.script`      | Vue script 中的国际化方法         | `t`                                                      |
| `typescript.importStatement` | TypeScript 文件的 i18n 引入语句   | `"import { i18n } from '@mgec/template/i18n/index.ts';"` |
| `typescript.i18nMethod`      | TypeScript 文件中的国际化方法     | `i18n.global.t`                                          |
| `javascript.importStatement` | JavaScript 文件的 i18n 引入语句   | `"import { i18n } from '@mgec/template/i18n/index.ts';"` |
| `javascript.i18nMethod`      | JavaScript 文件中的国际化方法     | `i18n.global.t`                                          |

## 🚀 快速开始

### 1️⃣ **测试单个文件（推荐）**

```bash
# 测试单个文件，查看处理效果
node test-single-file.js ../src/views/Column.vue

# 测试 TS 文件
node test-single-file.js ../src/utils/helper.ts
```

### 2️⃣ **批量处理**

```bash
# 先预览整个文件夹（会生成 views.json）
node batch-i18n-processor.js ../src/views --dry-run

# 确认无误后实际处理（默认生成以文件夹名命名的 JSON 文件）
node batch-i18n-processor.js ../src/views              # 生成 views.json
node batch-i18n-processor.js ../src/components         # 生成 components.json

# 自定义输出文件名
node batch-i18n-processor.js ../src/views --output ./locales/zh-CN.json
```

> **💡 提示**：脚本会自动以处理的文件夹名命名生成的 JSON 文件。例如处理 `../src/views` 会生成 `views.json`，这样便于按模块管理翻译文件。

### 3️⃣ **合并多个 JSON 词条文件**

如果你分多次处理文件，会生成多个 JSON 文件，可以使用合并脚本：

```bash
# 合并当前目录下所有 i18n-mapping*.json 文件
node merge-i18n-json.js

# 指定输入目录和输出文件
node merge-i18n-json.js --input ./locales --output ./locales/zh-CN.json

# 自定义文件匹配模式
node merge-i18n-json.js --pattern "i18n-*.json"

# 遇到重复 key 时覆盖旧值，并排序输出
node merge-i18n-json.js --overwrite --sort

# 查看帮助信息
node merge-i18n-json.js --help
```

**合并脚本选项说明：**

| 选项          | 说明                                    | 默认值               |
| ------------- | --------------------------------------- | -------------------- |
| `--input`     | JSON 文件所在目录                       | `./`                 |
| `--output`    | 合并后的输出文件路径                    | `./merged-i18n.json` |
| `--pattern`   | 文件匹配模式（支持通配符）              | `i18n-mapping*.json` |
| `--overwrite` | 遇到重复 key 时用新值覆盖（默认不覆盖） | `false`              |
| `--sort`      | 按 key 排序输出                         | `false`              |

**使用场景示例：**

```bash
# 场景1：分批处理不同模块（自动生成文件夹名.json）
node batch-i18n-processor.js ../src/views        # 生成 views.json
node batch-i18n-processor.js ../src/components   # 生成 components.json
node batch-i18n-processor.js ../src/utils        # 生成 utils.json

# 然后合并所有 JSON 文件
node merge-i18n-json.js --pattern "*.json" --output ./locales/zh-CN.json --sort

# 场景2：手动指定输出文件名
node batch-i18n-processor.js ../src/views --output ./i18n-views.json
node batch-i18n-processor.js ../src/components --output ./i18n-components.json

# 然后合并
node merge-i18n-json.js --pattern "i18n-*.json" --output ./locales/zh-CN.json --sort
```

## ⚡ **使用技巧**

### **分步骤处理**

```bash
# 1. 预览整个文件夹
node batch-i18n-processor.js ../src/views --dry-run

```

## 📄 许可证

MIT

## 👤 作者

xushiyu

---

**祝您的项目国际化顺利！** 🌍✨
