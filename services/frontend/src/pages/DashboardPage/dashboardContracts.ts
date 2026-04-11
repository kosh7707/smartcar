export interface DashboardExplorerCreateFlow {
  show: boolean;
  name: string;
  description: string;
  onToggle: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}
