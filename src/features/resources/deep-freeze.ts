/**
 * 递归冻结（纯函数，无依赖）。
 *
 * 为什么需要它：可信资料集是**只读产品资产**，但它以普通对象的形态在模块之间传递。
 * 只要有一处对返回值的 `push` / 赋值，污染就会沿着引用扩散到所有后续请求，
 * 而且不会报错 —— 只会让内容悄悄变形。
 *
 * 冻结把这类 bug 从"静默的脏数据"变成"当场抛错"，排查成本差一个数量级。
 * 注意 `Object.freeze` 是浅冻结，所以这里必须递归到叶子。
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;

  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}
