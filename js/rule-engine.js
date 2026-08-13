import {
  CERT_RANK,
  MAX_RATIO,
  countGroupDivers,
  isPlaceholderDm,
  isPlaceholderName,
  isValidTime,
  namesEqual,
  normalizeName,
  profileForSite,
  resolveDmName
} from "./board-model.js";

function issue(code, message, extra = {}) {
  return { code, message, ...extra };
}

export function inspectBoard(data) {
  const errors = [];
  const warnings = [];
  if (!data?.sessions) {
    return { errors: [issue("INVALID_BOARD", "Board data is missing sessions.")], warnings };
  }

  const seenPeopleBySlot = new Map();

  for (const [sessionId, session] of Object.entries(data.sessions)) {
    if (!isValidTime(session.displayTime)) {
      errors.push(issue("INVALID_TIME", `Session ${sessionId} has an invalid display time.`, { sessionId }));
    }
    if (session.sourceTime && !isValidTime(session.sourceTime)) {
      errors.push(issue("INVALID_TIME", `Session ${sessionId} has an invalid briefing time.`, { sessionId }));
    }

    const slotPeople = new Map();
    (session.groups || []).forEach((group, groupIndex) => {
      const dmName = resolveDmName(data, group);
      const hasDm = !isPlaceholderDm(dmName);
      const divers = (group.divers || []).filter(diver => !isPlaceholderName(diver?.name));
      const diverCount = divers.length;
      const max = MAX_RATIO;

      if (diverCount > 0 && !hasDm) {
        errors.push(issue("MISSING_DM", `Group ${groupIndex + 1} at ${session.displayTime || sessionId} has divers but no DM.`, { sessionId, groupIndex }));
      }
      if (hasDm && diverCount > max) {
        errors.push(issue("RATIO_EXCEEDED", `Group ${groupIndex + 1} at ${session.displayTime || sessionId} exceeds the 1:${max} DM ratio (${diverCount} divers).`, { sessionId, groupIndex, diverCount, max }));
      }
      if (!hasDm && diverCount > max) {
        errors.push(issue("RATIO_EXCEEDED", `Group ${groupIndex + 1} at ${session.displayTime || sessionId} has ${diverCount} divers without a DM.`, { sessionId, groupIndex }));
      }

      const namesInGroup = new Map();
      for (const diver of divers) {
        const key = normalizeName(diver.name).toLowerCase();
        if (namesInGroup.has(key)) {
          errors.push(issue("DUPLICATE_MEMBER", `Diver "${diver.name}" appears twice in group ${groupIndex + 1} at ${session.displayTime || sessionId}.`, { sessionId, groupIndex, name: diver.name }));
        }
        namesInGroup.set(key, true);
        if (slotPeople.has(key)) {
          errors.push(issue("TIME_CONFLICT", `"${diver.name}" is assigned to more than one group at ${session.displayTime || sessionId}.`, { sessionId, name: diver.name }));
        } else {
          slotPeople.set(key, { role: "diver", groupIndex });
        }
      }

      if (hasDm) {
        const dmKey = normalizeName(dmName).toLowerCase();
        if (slotPeople.has(dmKey)) {
          errors.push(issue("TIME_CONFLICT", `DM "${dmName}" is assigned to more than one group at ${session.displayTime || sessionId}.`, { sessionId, name: dmName }));
        } else {
          slotPeople.set(dmKey, { role: "dm", groupIndex });
        }
      }

      const siteText = `${group.context || ""} ${(data.overview || []).find(item => item.id === sessionId)?.site || ""}`;
      const profile = profileForSite(siteText);
      if (profile) {
        for (const diver of divers) {
          if (diver.maxDepthM != null && Number(diver.maxDepthM) < profile.maxDepthM) {
            warnings.push(issue("SITE_DEPTH", `"${diver.name}" max depth ${diver.maxDepthM}m is below typical ${profile.maxDepthM}m for this site.`, { sessionId, groupIndex, name: diver.name }));
          }
          if (diver.certification) {
            const have = CERT_RANK[diver.certification] || 0;
            const need = CERT_RANK[profile.minCert] || 0;
            if (have && need && have < need) {
              warnings.push(issue("SITE_CERT", `"${diver.name}" certification ${diver.certification} may be below ${profile.minCert} for this site.`, { sessionId, groupIndex, name: diver.name }));
            }
          }
        }
      }
    });

    seenPeopleBySlot.set(sessionId, slotPeople);
  }

  const slotTimes = Object.entries(data.sessions).map(([id, session]) => [id, session.displayTime]);
  for (let i = 0; i < slotTimes.length; i += 1) {
    for (let j = i + 1; j < slotTimes.length; j += 1) {
      if (slotTimes[i][1] && slotTimes[i][1] === slotTimes[j][1]) {
        const a = seenPeopleBySlot.get(slotTimes[i][0]);
        const b = seenPeopleBySlot.get(slotTimes[j][0]);
        if (!a || !b) continue;
        for (const key of a.keys()) {
          if (b.has(key)) {
            const name = key;
            errors.push(issue("TIME_CONFLICT", `"${name}" appears in two sessions that share ${slotTimes[i][1]}.`, { name }));
          }
        }
      }
    }
  }

  return { errors, warnings };
}

export function formatInspection(result) {
  if (!result.errors.length && !result.warnings.length) {
    return "No safety issues found. DM ratio, duplicates, missing DMs, and time conflicts look clear.";
  }
  const lines = [];
  for (const item of result.errors) lines.push(`Error: ${item.message}`);
  for (const item of result.warnings) lines.push(`Warning: ${item.message}`);
  return lines.join("\n");
}
