/**
 * 国际化处理配置文件
 */
module.exports = {
  /**
   * 翻译词条 JSON 文件的存放路径
   * 默认为 ./i18n-mapping.json
   */
  outputFile: './i18n-mapping.json',

  /**
   * 忽略的文件夹路径（支持 * 通配符）
   * 例如: ['node_modules', 'dist', '*.spec.ts', 'test/*']
   */
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

  /**
   * 要转换的文件类型
   */
  fileExtensions: ['.vue', '.ts', '.js'],

  /**
   * Vue 文件配置
   */
  vue: {
    /**
     * vue-i18n 引入语句
     */
    importStatement: "import { useI18n } from 'vue-i18n';",

    /**
     * useI18n 实例声明语句
     */
    instanceStatement: 'const { t } = useI18n();',

    /**
     * 国际化方法名（template中使用 $t，script中使用 t）
     */
    i18nMethod: {
      template: '$t', // template 中使用 $t
      script: 't',    // script 中使用 t
    },
  },

  /**
   * TypeScript/JavaScript 文件配置
   */
  typescript: {
    /**
     * i18n 引入语句
     */
    importStatement: "import { i18n } from '@mgec/template/i18n/index.ts';",

    /**
     * 国际化方法名
     */
    i18nMethod: 'i18n.global.t',
  },

  /**
   * JavaScript 文件配置（如果不设置，使用 typescript 的配置）
   */
  javascript: {
    /**
     * i18n 引入语句
     */
    importStatement: "import { i18n } from '@mgec/template/i18n/index.ts';",

    /**
     * 国际化方法名
     */
    i18nMethod: 'i18n.global.t',
  },
};

