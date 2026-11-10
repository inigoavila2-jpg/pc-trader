import { useDashboardModel } from "./dashboard/useDashboardModel.js";
import { DashboardTop } from "./dashboard/DashboardTop.jsx";
import { DashboardBottom } from "./dashboard/DashboardBottom.jsx";
import { AddExpenseModal, AddIncomeModal, TransferModal } from "../components/index.js";

export function Dashboard(props) {
  const model = useDashboardModel(props);
  const { addingExpense, addingIncome, transferring, dispatch, toast, businessBank, cashOnHand } = model;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {addingExpense&&<AddExpenseModal dispatch={dispatch} toast={toast} onClose={()=>model.setAddingExpense(false)}/>}
      {addingIncome&&<AddIncomeModal dispatch={dispatch} toast={toast} onClose={()=>model.setAddingIncome(false)}/>}
      {transferring&&<TransferModal dispatch={dispatch} toast={toast} onClose={()=>model.setTransferring(false)} businessBank={businessBank} cashOnHand={cashOnHand}/>}
      <DashboardTop model={model}/>
      <DashboardBottom model={model}/>
    </div>
  );
}
