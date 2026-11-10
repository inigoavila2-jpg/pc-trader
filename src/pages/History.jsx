import { useHistoryModel } from "./history/useHistoryModel.js";
import { HistoryContent } from "./history/HistoryContent.jsx";

export function History(props) {
  const model = useHistoryModel(props);
  return <HistoryContent model={model}/>;
}
