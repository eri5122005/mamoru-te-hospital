// Only boolean false marks a staff member as retired, including legacy data.
export function isActiveStaff(staff) {
  return staff?.isActive !== false;
}
