import React from "react";
import { EmptyState } from "./EmptyState";

interface Props {
  title: string;
}

export const ComingSoonPlaceholder: React.FC<Props> = ({ title }) => (
  <EmptyState
    title={`${title} — 준비 중`}
    description="이 기능은 현재 개발 중입니다."
  />
);
