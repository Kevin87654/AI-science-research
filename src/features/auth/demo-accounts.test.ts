/**
 * 演示账号的校验与搜索测试。
 *
 * 这些账号是临时的（登录逻辑由组员接手后会整体替换），但**行为要现在就对**：
 * 密码错了不能进、学生账号不能当导师登录、导师搜索不能把导师自己搜出来。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEMO_ACCOUNTS,
  demoCredentialHint,
  findAccountById,
  searchStudents,
  toProfile,
  verifyCredentials,
} from "./demo-accounts.ts";

const STUDENT = DEMO_ACCOUNTS.find((account) => account.role === "student")!;
const MENTOR = DEMO_ACCOUNTS.find((account) => account.role === "mentor")!;

test("正确的账号密码能通过", () => {
  assert.equal(verifyCredentials("student", STUDENT.id, STUDENT.password)?.id, STUDENT.id);
  assert.equal(verifyCredentials("mentor", MENTOR.id, MENTOR.password)?.id, MENTOR.id);
});

test("密码错误、账号不存在都返回 null", () => {
  assert.equal(verifyCredentials("student", STUDENT.id, "wrong-password"), null);
  assert.equal(verifyCredentials("student", "00000000", STUDENT.password), null);
});

test("身份与账号不匹配时拒绝（学生账号不能当导师登录）", () => {
  assert.equal(verifyCredentials("mentor", STUDENT.id, STUDENT.password), null);
  assert.equal(verifyCredentials("student", MENTOR.id, MENTOR.password), null);
});

test("工号忽略大小写与首尾空白", () => {
  assert.equal(findAccountById(` ${MENTOR.id.toLowerCase()} `)?.id, MENTOR.id);
});

test("导师搜索：按学号片段、按姓名都能命中，且只返回学生", () => {
  const byId = searchStudents(STUDENT.id.slice(0, 4));
  assert.ok(byId.some((account) => account.id === STUDENT.id));
  assert.ok(byId.every((account) => account.role === "student"));

  const byName = searchStudents(STUDENT.name.slice(0, 1));
  assert.ok(byName.some((account) => account.id === STUDENT.id));
});

test("导师搜索：空关键词不返回任何账号（不做查全表）", () => {
  assert.deepEqual(searchStudents(""), []);
  assert.deepEqual(searchStudents("   "), []);
  assert.deepEqual(searchStudents("查无此人"), []);
});

test("对外档案不含密码", () => {
  const profile = toProfile(STUDENT);
  assert.equal("password" in profile, false);
  assert.equal(profile.id, STUDENT.id);
  assert.equal(profile.role, "student");
});

test("登录弹窗的账号提示按身份取，且不会把密码混进档案", () => {
  assert.equal(demoCredentialHint("student")?.role, "student");
  assert.equal(demoCredentialHint("mentor")?.role, "mentor");
});
