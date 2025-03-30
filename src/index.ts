import prompts, { PromptObject } from "prompts";
import fs from "node:fs/promises";
import * as R from "ramda";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cwd } from "node:process";

const Regexp = {
  ASCII: /^[ -~]+$/,
  WhiteSpace: /\s/,
  WindowsInvalid: /[\\/:*?"<>|]/,
  Semver:
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
};

const thisPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const questions: PromptObject[] = [
  {
    type: "select",
    name: "type",
    message: "选择项目类型",
    choices: [{ title: "主题", value: "theme" }],
    hint: "- 上下选择，回车选定",
  },
  {
    type: "text",
    name: "name",
    message: "项目名称",
    initial: "doing-theme",
    validate: (value: string) => {
      if (value.trim() == "") return "请不要空白名称";
      if (Regexp.WhiteSpace.test(value)) return "名称中请不要包含空格";
      if (Regexp.WindowsInvalid.test(value)) {
        return '名称中请不要包含^\\/:*?"<>|';
      }
      return true;
    },
  },
  {
    type: "confirm",
    name: "ts",
    message: "是否使用TypeScript (当前暂不支持TS, 请默认该项)",
    initial: false,
  },
  {
    type: "multiselect",
    name: "features",
    message: "选择要支持的特性",
    choices: [
      { title: "暗黑模式", value: "darkMode" },
      { title: "跟随专注颜色", value: "followActionColor" },
    ],
    min: 0,
    hint: "- 空格切换选定，回车确认",
    instructions: false,
  },
];

interface Options {
  type: string;
  name: string;
  ts: boolean;
  features: string[];
}
(async () => {
  console.log("欢迎来到 Create Doing");
  const result = await prompts(questions);
  const options: Options = result as Options;
  let answer = true;
  try {
    await fs.access(path.join(cwd(), options.name));
    answer = (
      await prompts({
        type: "confirm",
        name: "override",
        message: "目标文件夹已存在,是否覆盖?",
        initial: false,
      })
    ).override;
  } catch (_) {}
  if (answer) {
    initCommonProject(options);
  }
})();

async function initCommonProject(options: Options) {
  const structure = JSON.parse(
    await fs.readFile(path.join(thisPath, "./templates/structure.json"), "utf-8")
  );
  const commonStructure = structure.common;
  const from = R.replace("$this", thisPath);
  const to = R.replace("$for", path.join(cwd(), options.name));
  const uuid = crypto.randomUUID();
  const process = R.pipe(
    R.replace("{<name>}", options.name),
    R.replace("{<features>}", options.features.map((f) => `"${f}"`).join(",")),
    R.replace("{<uuid>}", uuid)
  );
  let promises: Promise<void>[] = [];
  for (const key in commonStructure) {
    const promise = new Promise<void>(async (resolve, reject) => {
      const [f, t] = [from(commonStructure[key]), to(key)];
      const file = await fs.readFile(f, "utf-8");
      const content = process(file);
      await initFile(path.dirname(t));
      await fs.writeFile(t, content, "utf-8");
      resolve();
    });
    promises.push(promise);
  }
  await Promise.all(promises);
}

async function initFile(filename: string) {
  try {
    try {
      await fs.access(filename, fs.constants.W_OK);
    } catch (_) {
      await fs.mkdir(filename, { recursive: true });
    }
  } catch (_) {}
}
