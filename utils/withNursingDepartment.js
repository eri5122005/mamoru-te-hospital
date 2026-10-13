// Add the new department without changing saved wards or existing identifiers.
export function withNursingDepartment(wards) {
  if (wards.some((ward) => ward.id === "nursing" || ward.wardId === "nursing")) return wards;
  const order = Math.max(0, ...wards.map((ward) => Number(ward.order) || 0)) + 1;
  return [...wards, { id: "nursing", wardId: "nursing", name: "看護部", order }];
}
