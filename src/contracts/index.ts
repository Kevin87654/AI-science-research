/**
 * 契约入口。业务代码从这里取类型，不要逐个文件深引用，
 * 这样以后拆分/合并契约文件时不需要改业务代码。
 *
 * `export type *` 只导出类型、不产生运行时代码，也不会把契约带进打包产物。
 */
export type * from "./api";
export type * from "./assessment";
export type * from "./catalog";
export type * from "./common";
export type * from "./identity";
export type * from "./knowledge";
export type * from "./profile";
export type * from "./progress";
export type * from "./roadmap";
export type * from "./source";
