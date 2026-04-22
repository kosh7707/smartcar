import React from "react";

interface CreateProjectFormProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ name, description, onNameChange, onDescriptionChange, onCreate, onCancel }) => (
  <div className="placeholder-card">
    <span className="eyebrow">new project</span>
    <input className="form-input" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="프로젝트 이름" autoFocus onKeyDown={(event) => event.key === "Enter" && onCreate()} />
    <input className="form-input" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="설명 (선택)" onKeyDown={(event) => event.key === "Enter" && onCreate()} />
    <div className="actions">
      <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>취소</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>만들기</button>
    </div>
  </div>
);
