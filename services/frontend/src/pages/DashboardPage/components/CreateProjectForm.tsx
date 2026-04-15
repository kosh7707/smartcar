import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./CreateProjectForm.css";

interface CreateProjectFormProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ name, description, onNameChange, onDescriptionChange, onCreate, onCancel }) => {
  return (
    <div className="create-project-form">
      <Input className="create-project-form__input" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="프로젝트 이름" autoFocus onKeyDown={(event) => event.key === "Enter" && onCreate()} />
      <Input className="create-project-form__input" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="설명 (선택)" onKeyDown={(event) => event.key === "Enter" && onCreate()} />
      <div className="create-project-form__actions">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
        <Button type="button" size="sm" onClick={onCreate}>만들기</Button>
      </div>
    </div>
  );
};
