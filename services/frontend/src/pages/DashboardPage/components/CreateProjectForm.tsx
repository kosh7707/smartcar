import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="프로젝트 이름" autoFocus onKeyDown={(event) => event.key === "Enter" && onCreate()} />
    <Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="설명 (선택)" onKeyDown={(event) => event.key === "Enter" && onCreate()} />
    <div className="actions">
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
      <Button type="button" size="sm" onClick={onCreate}>만들기</Button>
    </div>
  </div>
);
