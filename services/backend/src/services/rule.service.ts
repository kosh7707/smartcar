import crypto from "crypto";
import type { Severity, Rule } from "@smartcar/shared";
import { ruleDAO } from "../dao/rule.dao";
import { RuleEngine } from "../rules/rule-engine";
import { CustomRule } from "../rules/custom-rule";
import { DEFAULT_RULE_TEMPLATES } from "../rules/default-rule-templates";
import { createLogger } from "../lib/logger";

const logger = createLogger("rule-service");

export class RuleService {
  /** 프로젝트 생성 시 기본 룰 22개를 시딩한다 */
  seedDefaultRules(projectId: string): void {
    const pid = projectId.replace(/^proj-/, "").slice(0, 8);

    for (const tpl of DEFAULT_RULE_TEMPLATES) {
      const rule: Rule = {
        id: `RULE-${tpl.idSuffix}-${pid}`,
        name: tpl.name,
        severity: tpl.severity,
        description: tpl.description,
        suggestion: tpl.suggestion,
        pattern: tpl.pattern,
        fixCode: tpl.fixCode,
        enabled: true,
        projectId,
        createdAt: new Date().toISOString(),
      };
      ruleDAO.save(rule); // INSERT OR IGNORE — 중복 방지
    }
  }

  /** 프로젝트의 enabled 룰로 분석용 RuleEngine을 빌드한다 */
  buildRuleEngine(projectId: string): RuleEngine {
    const engine = new RuleEngine();
    const rules = ruleDAO.findByProjectId(projectId);

    for (const rule of rules) {
      if (!rule.enabled) continue;
      try {
        engine.registerRule(new CustomRule(rule));
      } catch (err) {
        logger.warn({ err, ruleId: rule.id, pattern: rule.pattern }, "Invalid rule pattern — skipped");
      }
    }

    return engine;
  }

  findByProjectId(projectId: string): Rule[] {
    return ruleDAO.findByProjectId(projectId);
  }

  findAll(): Rule[] {
    return ruleDAO.findAll();
  }

  findById(id: string): Rule | undefined {
    return ruleDAO.findById(id);
  }

  create(projectId: string, fields: {
    name: string;
    severity: Severity;
    description: string;
    suggestion?: string;
    pattern: string;
    fixCode?: string;
  }): Rule {
    // 정규식 유효성 검증
    new RegExp(fields.pattern);

    const rule: Rule = {
      id: `RULE-CUSTOM-${crypto.randomUUID().slice(0, 8)}`,
      name: fields.name,
      severity: fields.severity,
      description: fields.description,
      suggestion: fields.suggestion ?? "",
      pattern: fields.pattern,
      fixCode: fields.fixCode,
      enabled: true,
      projectId,
      createdAt: new Date().toISOString(),
    };

    ruleDAO.save(rule);
    return rule;
  }

  update(id: string, fields: Partial<{
    name: string;
    severity: Severity;
    description: string;
    suggestion: string;
    pattern: string;
    fixCode: string;
    enabled: boolean;
  }>): Rule | undefined {
    const existing = ruleDAO.findById(id);
    if (!existing) return undefined;

    if (fields.pattern !== undefined) {
      new RegExp(fields.pattern); // 유효성 검증
    }

    return ruleDAO.update(id, fields);
  }

  delete(id: string): boolean {
    return ruleDAO.delete(id);
  }

  deleteByProjectId(projectId: string): void {
    ruleDAO.deleteByProjectId(projectId);
  }
}
