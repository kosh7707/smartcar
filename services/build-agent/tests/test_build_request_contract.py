from app.schemas.request import BuildMode, BuildResolveContract, ContractVersion
from app.validators.build_request_contract import BuildRequestContractValidator, normalize_contract_version
from app.schemas.request import Context, TaskRequest
from app.types import TaskType


def _request(trusted: dict) -> TaskRequest:
    return TaskRequest(
        taskType=TaskType.BUILD_RESOLVE,
        taskId="build-contract-test",
        context=Context(trusted=trusted),
    )


def test_canonical_strict_contract_fields_parse() -> None:
    contract = BuildResolveContract.model_validate(
        {
            "projectPath": "/tmp/project",
            "subprojectPath": "gateway",
            "subprojectName": "gateway",
            "contractVersion": "build-resolve-v1",
            "strictMode": True,
            "build": {"mode": "native"},
            "expectedArtifacts": [{"kind": "executable", "path": "build-aegis/gateway"}],
        }
    )

    assert contract.subprojectPath == "gateway"
    assert contract.subprojectName == "gateway"
    assert contract.targetPath == "gateway"
    assert contract.targetName == "gateway"
    assert contract.buildMode == BuildMode.NATIVE
    assert contract.contractVersion == ContractVersion.BUILD_RESOLVE_V1
    assert normalize_contract_version(contract) == "build-resolve-v1"
    assert contract.expectedArtifacts[0].artifactType.value == "executable"



def test_legacy_aliases_normalize_to_canonical_contract() -> None:
    contract = BuildResolveContract.model_validate(
        {
            "projectPath": "/tmp/project",
            "targetPath": "gateway",
            "targetName": "gateway",
            "contractVersion": "compile-first-v1",
            "strictMode": True,
            "buildMode": "sdk",
            "sdkId": "sdk-1",
            "expectedArtifacts": [{"artifactType": "executable", "path": "gateway"}],
        }
    )

    assert contract.subprojectPath == "gateway"
    assert contract.subprojectName == "gateway"
    assert contract.buildMode == BuildMode.SDK
    assert contract.sdkId == "sdk-1"
    assert contract.contractVersion == ContractVersion.BUILD_RESOLVE_V1
    assert normalize_contract_version(contract) == "build-resolve-v1"



def test_preflight_requires_canonical_subproject_fields_in_strict_mode() -> None:
    validator = BuildRequestContractValidator()
    preflight, errors = validator.validate(
        _request(
            {
                "projectPath": "/tmp/project",
                "contractVersion": "build-resolve-v1",
                "strictMode": True,
                "build": {"mode": "native"},
                "expectedArtifacts": [{"kind": "executable", "path": "gateway"}],
            }
        )
    )

    assert preflight is None
    assert any("subprojectPath" in error for error in errors)
    assert any("subprojectName" in error for error in errors)
