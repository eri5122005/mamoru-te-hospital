import { handleStaffWeightSettings } from "../../../utils/handleStaffWeightSettings";

export default function handler(req, res) {
  return handleStaffWeightSettings(req, res, true);
}
