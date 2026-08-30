export default function handler(req, res) {
  res.status(200).json([
    { name: "4階病棟", rate: 0 },
    { name: "5階病棟", rate: 0 },
    { name: "6階病棟", rate: 0 },
    { name: "7.8階病棟", rate: 0 },
    { name: "外来", rate: 0 },
    { name: "透析室", rate: 0 },
    { name: "リハビリ室", rate: 0 },
    { name: "医局", rate: 0 },
  ]);
}
