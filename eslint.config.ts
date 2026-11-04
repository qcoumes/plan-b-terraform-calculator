// Mostly the Google TypeScript style guide (https://ts.dev/style/).
import js from "@eslint/js";
import { vueTsConfigs, withVueTs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

const FORBIDDEN_SYNTAX = [
  { selector: "ExportDefaultDeclaration", message: "Use a named export." },
  { selector: "ExportNamedDeclaration > VariableDeclaration[kind='let']", message: "Export a getter instead of `export let`." },
  {
    selector: ":matches(ExportAllDeclaration, ExportNamedDeclaration)[exportKind='type'][source]",
    message: "Use `export ... from` without `type`.",
  },
  { selector: "CallExpression[callee.property.name='forEach']", message: "Use a for-of loop." },
  {
    selector: "ArrowFunctionExpression > :matches(AssignmentExpression, UpdateExpression).body",
    message: "Use a block body: the arrow's value isn't used.",
  },
  {
    selector: ":matches(ForStatement, ForInStatement, ForOfStatement, WhileStatement, DoWhileStatement) > :not(BlockStatement).body",
    message: "Loops need braces.",
  },
  { selector: "CallExpression[callee.name='Error']", message: "Use `new Error()`." },
  { selector: "PrivateIdentifier", message: "Use `private` instead of #fields." },
  { selector: "TSEnumDeclaration[const=true]", message: "Use a plain `enum`." },
  {
    selector: "TSTypeAliasDeclaration > TSUnionType > :matches(TSNullKeyword, TSUndefinedKeyword)",
    message: "Add `| null` where the alias is used, not in the alias.",
  },
  {
    selector: ":matches(TSPropertySignature, PropertyDefinition) > TSTypeAnnotation > TSUnionType > TSUndefinedKeyword",
    message: "Use an optional field (`name?:`).",
  },
  {
    selector: ":function > Identifier.params > TSTypeAnnotation > TSUnionType > TSUndefinedKeyword",
    message: "Use an optional parameter (`name?:`).",
  },
];

export default withVueTs(
  // Otherwise the helper turns the no-unsafe-* rules off everywhere, after this config.
  { allowComponentTypeUnsafety: false },

  { ignores: ["dist/**", "coverage/**"] },

  js.configs.recommended,
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommendedTypeChecked,

  {
    languageOptions: { globals: globals.browser },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "forbid", trailingUnderscore: "forbid" },
        { selector: "variable", modifiers: ["const"], format: ["camelCase", "UPPER_CASE"] },
        { selector: "import", format: ["camelCase", "PascalCase"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE"] },
        // Object keys are often data: game ids, localization keys, CSS variables.
        { selector: ["objectLiteralProperty", "objectLiteralMethod"], format: null },
      ],
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
      "@typescript-eslint/prefer-readonly": "error",

      "no-implicit-coercion": ["error", { allow: ["!!"] }],
      "no-restricted-globals": [
        "error",
        { name: "parseInt", message: "Use Number() and check for NaN." },
        { name: "parseFloat", message: "Use Number() and check for NaN." },
        { name: "isNaN", message: "Use Number.isNaN()." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Number", property: "parseInt", message: "Use Number() and check for NaN." },
        { object: "Number", property: "parseFloat", message: "Use Number() and check for NaN." },
      ],
      "no-new-wrappers": "error",

      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-use-before-define": ["error", { functions: false, typedefs: false, ignoreTypeReferences: true }],

      curly: ["error", "multi-line"],
      "default-case": "error",
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      eqeqeq: ["error", "always", { null: "ignore" }],

      "func-style": ["error", "declaration", { allowTypeAnnotation: true }],
      "prefer-arrow-callback": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",

      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as", objectLiteralTypeAssertions: "never" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "no-type-imports" }],

      "no-restricted-syntax": ["error", ...FORBIDDEN_SYNTAX],
      "no-console": "error",

      "vue/block-order": ["error", { order: ["template", "script:not([setup])", "script[setup]", "style"] }],
      "vue/block-lang": ["error", { script: { lang: "ts" } }],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/define-macros-order": ["error", { order: ["defineOptions", "defineProps", "defineEmits", "defineModel", "defineSlots"] }],
      "vue/define-props-declaration": ["error", "type-based"],
      "vue/define-emits-declaration": ["error", "type-based"],
      "vue/no-unused-refs": "error",
      "vue/no-useless-v-bind": "error",
      "vue/no-v-html": "error",
      "vue/prefer-true-attribute-shorthand": "error",
      "vue/require-typed-ref": "error",
      "vue/max-attributes-per-line": ["warn", { singleline: { max: 4 }, multiline: { max: 1 } }],
      // Moving `<b>{{ n }}</b>` content onto its own lines adds visible spaces.
      "vue/singleline-html-element-content-newline": "off",
    },
  },

  // typescript-eslint can't fully type Vue components, so they show up as `any` in .vue files.
  {
    files: ["**/*.vue"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  { files: ["src/main.ts"], rules: { "@typescript-eslint/no-unsafe-argument": "off" } },

  {
    files: ["*.config.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": "off" },
  },
  // ESLint and Vite need a default export here.
  {
    files: ["*.config.ts"],
    rules: { "no-restricted-syntax": ["error", ...FORBIDDEN_SYNTAX.filter((rule) => rule.selector !== "ExportDefaultDeclaration")] },
  },
);
