#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const defaultRefRoot = "/tmp/prism-goal-refs";
const soofiPath = process.env.SOOFI_TEAM_KIT_PATH || path.join(defaultRefRoot, "soofi-team-kit");
const elephantPath = process.env.ELEPHANT_SKILLS_PATH || path.join(defaultRefRoot, "elephant-skills");
const outPath = path.join(root, "packages/team-kit-source/src/generated/reference-snapshot.json");
const SOOFI_TEAM_KIT_REPO = "https://github.com/soofi-xyz/soofi-xyz-team-kit";
const SOOFI_TEAM_KIT_PR_54 = "https://github.com/soofi-xyz/soofi-xyz-team-kit/pull/54";
const ELEPHANT_SKILLS_REPO = "https://github.com/elephant-xyz/skills";

function assertDir(dir, label) {
  if (!fs.existsSync(dir)) {
    throw new Error(`${label} not found at ${dir}. Clone the repo or set the matching *_PATH env var.`);
  }
}

function git(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], { encoding: "utf8" }).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listFiles(dir, predicate) {
  const found = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (predicate(full)) found.push(full);
    }
  }
  walk(dir);
  return found.sort();
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return { data: {}, body: markdown };
  const end = markdown.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: markdown };
  const raw = markdown.slice(4, end).trim();
  const body = markdown.slice(end + 4).trim();
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    const trimmed = value.trim();
    if (trimmed === "true") data[key] = true;
    else if (trimmed === "false") data[key] = false;
    else data[key] = trimmed.replace(/^["']|["']$/g, "");
  }
  return { data, body };
}

function sentence(text) {
  return text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)[0] || "";
}

function titleCase(id) {
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRole(description, name) {
  const clean = description.replace(/\s+/g, " ").trim();
  const dash = clean.split(/\s+[—-]\s+/);
  if (dash.length > 1 && dash[0].length <= 80) return dash[0];
  const first = sentence(clean);
  if (first.length <= 96) return first.replace(/\.$/, "");
  return titleCase(name);
}

function extractSkills(agentBody, allSkillIds) {
  const ids = new Set();
  for (const match of agentBody.matchAll(/skills\/([a-z0-9-]+)/gi)) ids.add(match[1]);
  for (const skill of allSkillIds) {
    if (agentBody.includes(`\`${skill}\``) || agentBody.includes(`[${skill}]`)) ids.add(skill);
  }
  return [...ids].filter((skill) => allSkillIds.has(skill)).sort();
}

function inferDeps(description, skills) {
  const haystack = `${description} ${skills.join(" ")}`.toLowerCase();
  const deps = [];
  const add = (needle, label) => {
    if (haystack.includes(needle.toLowerCase()) && !deps.includes(label)) deps.push(label);
  };
  add("bedrock", "Bedrock");
  add("opensearch", "OpenSearch");
  add("dynamodb", "DynamoDB");
  add("lambda", "Lambda");
  add("asana", "Asana");
  add("vercel", "Vercel");
  add("neon", "Neon");
  add("elephant-query-db", "Elephant Query DB");
  add("use-elephant-query-db", "Elephant Query DB");
  add("sunbiz", "Sunbiz");
  add("bbb", "BBB");
  return deps;
}

function inferRuntime(description, skills) {
  const haystack = `${description} ${skills.join(" ")}`.toLowerCase();
  if (haystack.includes("lambda") || haystack.includes("bedrock")) return "AWS Lambda · Bedrock";
  if (haystack.includes("vercel") || haystack.includes("neon")) return "Vercel · Neon";
  if (haystack.includes("figma") || haystack.includes("frontend")) return "Node · Frontend";
  return "Cursor / Copilot CLI";
}

function parseAgentMascots(readme) {
  const mascots = new Map();
  for (const line of readme.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const idMatch = cells[1].match(/\[`?([a-z0-9-]+)`?\]\(\.\/agents\/[a-z0-9-]+\.md\)/i);
    if (!idMatch) continue;
    const imageMatch = cells[0].match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>/i);
    if (imageMatch) {
      mascots.set(idMatch[1], { iconUrl: imageMatch[1], iconLabel: imageMatch[2] });
      continue;
    }
    const glyph = cells[0].replace(/`/g, "").trim();
    if (glyph && glyph !== "Mascot" && !glyph.includes("---")) {
      mascots.set(idMatch[1], { iconLabel: glyph });
    }
  }
  return mascots;
}

function statusFor(id) {
  const certified = new Set(["arceus", "alakazam", "espeon", "metagross"]);
  const registered = new Set(["sylveon", "audino", "porygon"]);
  const review = new Set(["oracle", "regigigas", "castform"]);
  const rejected = new Set(["smeargle"]);
  const deprecated = new Set(["machamp"]);
  if (certified.has(id)) return "Certified";
  if (registered.has(id)) return "Registered";
  if (review.has(id)) return "Discovered";
  if (rejected.has(id)) return "Rejected";
  if (deprecated.has(id)) return "Deprecated";
  return "Discovered";
}

function sync() {
  assertDir(soofiPath, "Soofi team-kit repo");
  assertDir(elephantPath, "Elephant skills repo");

  const plugin = readJson(path.join(soofiPath, "plugin.json"));
  const soofiCommit = git(soofiPath, ["rev-parse", "HEAD"]);
  let pr54Commit = null;
  try {
    pr54Commit = git(soofiPath, ["rev-parse", "pr-54"]);
  } catch {
    pr54Commit = null;
  }
  const elephantCommit = git(elephantPath, ["rev-parse", "HEAD"]);
  const agentMascots = parseAgentMascots(fs.readFileSync(path.join(soofiPath, "README.md"), "utf8"));

  const skillFiles = listFiles(path.join(soofiPath, "skills"), (file) => file.endsWith("/SKILL.md"));
  const skills = skillFiles.map((file) => {
    const relative = path.relative(soofiPath, file);
    const id = relative.split(path.sep)[1];
    const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    return {
      id,
      name: data.name || id,
      description: data.description || sentence(body),
      path: relative.replaceAll(path.sep, "/"),
      docs: `${SOOFI_TEAM_KIT_REPO}/blob/main/${relative.replaceAll(path.sep, "/")}`
    };
  });
  const skillIds = new Set(skills.map((skill) => skill.id));

  const agentFiles = listFiles(path.join(soofiPath, "agents"), (file) => file.endsWith(".md"));
  const agents = agentFiles.map((file) => {
    const relative = path.relative(soofiPath, file).replaceAll(path.sep, "/");
    const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    const id = data.name || path.basename(file, ".md");
    const agentSkills = extractSkills(body, skillIds);
    const status = statusFor(id);
    const mascot = agentMascots.get(id) ?? {};
    return {
      id,
      display: id,
      role: inferRole(data.description || "", id),
      status,
      version: plugin.version || "0.0.0",
      summary: data.description || sentence(body),
      triggers: `/${id} ${inferRole(data.description || "", id)}`,
      ...mascot,
      skills: agentSkills,
      deps: inferDeps(data.description || "", agentSkills),
      runtime: inferRuntime(data.description || "", agentSkills),
      docs: `${SOOFI_TEAM_KIT_REPO}/blob/main/${relative}`,
      source: "team-kit",
      certifiedDate: status === "Certified" ? "2026-06-18" : null,
      reviewer: status === "Certified" ? "platform-governance" : null,
      sourcePath: relative,
      sourceRepo: SOOFI_TEAM_KIT_REPO,
      sourceCommit: soofiCommit,
      model: data.model || undefined
    };
  });

  const elephantSkillFiles = listFiles(path.join(elephantPath, "skills"), (file) => file.endsWith("/SKILL.md"));
  const elephantSkills = elephantSkillFiles.map((file) => {
    const relative = path.relative(elephantPath, file).replaceAll(path.sep, "/");
    const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    return {
      id: relative.split("/")[1],
      name: data.name || relative.split("/")[1],
      description: data.description || sentence(body),
      path: relative,
      docs: `${ELEPHANT_SKILLS_REPO}/blob/main/${relative}`
    };
  });

  const snapshot = {
    syncedAt: new Date().toISOString(),
    soofi: {
      repo: SOOFI_TEAM_KIT_REPO,
      commit: soofiCommit,
      version: plugin.version || "0.0.0",
      agentCount: agents.length,
      skillCount: skills.length,
      agentsPath: "agents/*.md",
      skillsPath: "skills/*/SKILL.md"
    },
    pr54: {
      repo: SOOFI_TEAM_KIT_PR_54,
      commit: pr54Commit,
      includesElephantQuerySkill: skills.some((skill) => skill.id === "use-elephant-query-db")
    },
    elephant: {
      repo: ELEPHANT_SKILLS_REPO,
      commit: elephantCommit,
      skillCount: elephantSkills.length
    },
    sources: [
      {
        id: "soofi-team-kit",
        label: "Soofi XYZ Team Kit",
        repo: SOOFI_TEAM_KIT_REPO,
        ref: "main",
        commit: soofiCommit,
        files: agentFiles.length + skillFiles.length,
        agents: agents.length,
        skills: skills.length,
        includes: ["agents/*.md", "skills/*/SKILL.md", "plugin.json"]
      },
      {
        id: "soofi-team-kit-pr-54",
        label: "Soofi PR #54 · elephant query db usage skill",
        repo: SOOFI_TEAM_KIT_PR_54,
        ref: "pull/54/head",
        commit: pr54Commit || "unavailable",
        files: pr54Commit ? 15 : 0,
        skills: skills.some((skill) => skill.id === "use-elephant-query-db") ? 1 : 0,
        includes: ["skills/use-elephant-query-db/SKILL.md"]
      },
      {
        id: "elephant-skills",
        label: "Elephant Oracle Skills",
        repo: ELEPHANT_SKILLS_REPO,
        ref: "main",
        commit: elephantCommit,
        files: elephantSkillFiles.length,
        skills: elephantSkills.length,
        includes: ["skills/*/SKILL.md"]
      }
    ],
    agents,
    skills,
    elephantSkills
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outPath, agents: agents.length, skills: skills.length, elephantSkills: elephantSkills.length }, null, 2));
}

sync();
