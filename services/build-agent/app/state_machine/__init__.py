"""Build Agent orchestration/state-machine boundary.

This package owns survival-boundary vocabulary for Build Agent. Deterministic
preflight/phase0/workspace setup is orchestration; Producer modules author
build artifacts; ``app.quality`` classifies contract/artifact/build-domain
outcomes; final envelope authority remains with the orchestrating handlers and
assemblers.
"""

from .types import BuildDependencyState, BuildOrchestratorDecision

__all__ = ["BuildDependencyState", "BuildOrchestratorDecision"]
