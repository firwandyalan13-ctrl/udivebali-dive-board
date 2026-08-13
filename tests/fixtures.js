export function sampleBoard() {
  return {
    date: { display: "11 AUG 2026", weekday: "Tuesday" },
    safety: "DM RATIO 1:3",
    overviewSafety: "DM RATIO 1:3",
    overview: [
      { id: "slot-0900", time: "09:00", status: "IN WATER", dmGroups: 0, divers: 0, site: "Coral Garden" },
      { id: "slot-1100", time: "11:00", status: "STANDBY", dmGroups: 0, divers: 0, site: "Dropoff" },
      { id: "slot-1400", time: "14:00", status: "STANDBY", dmGroups: 0, divers: 0, site: "Liberty Wreck USAT" },
      { id: "slot-1830", time: "18:30", status: "NIGHT DIVE", dmGroups: 0, divers: 0, site: "Liberty Wreck USAT" }
    ],
    sessions: {
      "slot-0900": session("08:30", "09:00", "IN WATER", [
        group("Alan", "Coral Garden", ["Budi", "-", "-"])
      ]),
      "slot-1100": session("10:30", "11:00", "STANDBY", [
        group("Nyoman", "Dropoff", ["-", "-", "-"])
      ]),
      "slot-1400": session("14:00", "14:00", "STANDBY", [
        group("unassigned", "Liberty Wreck USAT", ["-", "-", "-"])
      ]),
      "slot-1830": session("18:30", "18:30", "NIGHT DIVE", [
        group("unassigned", "Liberty Wreck USAT", ["-", "-", "-"])
      ])
    },
    dmRoster: [
      { id: "dm-alan", name: "Alan", photo: "" },
      { id: "dm-nyoman", name: "Nyoman", photo: "" }
    ]
  };
}

function session(sourceTime, displayTime, status, extraGroups) {
  const groups = Array.from({ length: 9 }, () => group("unassigned", "—", ["-", "-", "-"]));
  extraGroups.forEach((item, index) => { groups[index] = item; });
  return { sourceTime, displayTime, status, summary: "0 DM · 0 DIVERS", groups };
}

function group(dm, context, names) {
  return {
    marker: "P",
    dm,
    dmId: dm === "Alan" ? "dm-alan" : dm === "Nyoman" ? "dm-nyoman" : "",
    capacity: "0/3",
    context,
    divers: names.map(name => ({ name, note: "-" }))
  };
}
