from app.routers import tasks
from app.schemas.request import BuildMode, BuildResolveContract, ContractVersion
from app.schemas.response import AssessmentResult, AuditInfo, TaskSuccessResponse, TokenUsage, ValidationInfo
from app.validators.build_request_contract import BuildRequestContractValidator, normalize_contract_version
from app.schemas.request import Context, TaskRequest
from app.types import TaskStatus
from app.types import TaskType


def _request(trusted: dict) -> TaskRequest:
    return TaskRequest(
        taskType=TaskType.BUILD_RESOLVE,
        taskId="build-contract-test",
        context=Context(trusted=trusted),
    )


def _completed_response(task_type: TaskType = TaskType.BUILD_RESOLVE) -> TaskSuccessResponse:
    return TaskSuccessResponse(
        taskId="build-contract-http-001",
        taskType=task_type,
        status=TaskStatus.COMPLETED,
        modelProfile="test",
        promptVersion="build-agent-v1",
        schemaVersion="build-v1.1",
        validation=ValidationInfo(valid=True, errors=[]),
        result=AssessmentResult(
            summary="build completed",
            claims=[],
            caveats=[],
            usedEvidenceRefs=[],
            buildResult={"success": True, "buildCommand": "make", "buildScript": "build.sh"},
        ),
        audit=AuditInfo(
            inputHash="sha256:test",
            latencyMs=0,
            tokenUsage=TokenUsage(prompt=0, completion=0),
            retryCount=0,
            ragHits=0,
            createdAt="2026-04-29T00:00:00Z",
        ),
    )


def test_canonical_strict_contract_fields_parse() -> None:
    contract = BuildResolveContract.model_validate(
        {
            "projectPath": "/tmp/project",
            "buildTargetPath": "gateway",
            "buildTargetName": "gateway",
            "contractVersion": "build-resolve-v1",
            "strictMode": True,
            "build": {"mode": "native", "scriptHintText": "make -j4\n"},
            "expectedArtifacts": [{"kind": "executable", "path": "build-aegis/gateway"}],
        }
    )

    assert contract.buildTargetPath == "gateway"
    assert contract.buildTargetName == "gateway"
    assert contract.targetPath == "gateway"
    assert contract.targetName == "gateway"
    assert contract.buildMode == BuildMode.NATIVE
    assert contract.contractVersion == ContractVersion.BUILD_RESOLVE_V1
    assert normalize_contract_version(contract) == "build-resolve-v1"
    assert contract.expectedArtifacts[0].artifactType.value == "executable"
    assert contract.buildScriptHintText == "make -j4"



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
            "buildEnvironment": {"CC": "arm-linux-gnueabihf-gcc"},
            "expectedArtifacts": [{"artifactType": "executable", "path": "gateway"}],
        }
    )

    assert contract.buildTargetPath == "gateway"
    assert contract.buildTargetName == "gateway"
    assert contract.buildMode == BuildMode.SDK
    assert contract.sdkId == "sdk-1"
    assert contract.buildEnvironment == {"CC": "arm-linux-gnueabihf-gcc"}
    assert contract.contractVersion == ContractVersion.BUILD_RESOLVE_V1
    assert normalize_contract_version(contract) == "build-resolve-v1"


def test_task_request_accepts_top_level_strict_contract_fields() -> None:
    request = TaskRequest.model_validate(
        {
            "taskType": "build-resolve",
            "taskId": "build-contract-top-level-001",
            "contractVersion": "build-resolve-v1",
            "strictMode": True,
            "context": {
                "trusted": {
                    "projectPath": "/tmp/project",
                    "buildTargetPath": "gateway",
                    "buildTargetName": "gateway",
                    "build": {"mode": "native"},
                    "expectedArtifacts": [{"kind": "executable", "path": "gateway"}],
                },
            },
        }
    )

    contract = request.build_resolve_contract()
    assert contract.contractVersion == ContractVersion.BUILD_RESOLVE_V1
    assert contract.strictMode is True
    assert contract.buildTargetPath == "gateway"
    assert contract.buildTargetName == "gateway"



def test_preflight_requires_canonical_build_target_fields_in_strict_mode() -> None:
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
    assert any("buildTargetPath" in error for error in errors)
    assert any("buildTargetName" in error for error in errors)


def test_strict_sdk_requires_materialization_source() -> None:
    validator = BuildRequestContractValidator()
    preflight, errors = validator.validate(
        _request(
            {
                "projectPath": "/tmp/project",
                "buildTargetPath": "gateway",
                "buildTargetName": "gateway",
                "contractVersion": "build-resolve-v1",
                "strictMode": True,
                "build": {"mode": "sdk", "sdkId": "sdk-1"},
                "expectedArtifacts": [{"kind": "executable", "path": "gateway"}],
            }
        )
    )

    assert preflight is None
    assert any("materialization source" in error for error in errors)


def test_build_route_accepts_camel_case_generation_constraints(client, monkeypatch) -> None:
    captured = {}

    async def fake_build(request):
        captured["constraints"] = request.constraints
        return _completed_response()

    monkeypatch.setattr(tasks, "_handle_build_resolve", fake_build)

    response = client.post(
        "/v1/tasks",
        json={
            "taskType": "build-resolve",
            "taskId": "build-contract-http-constraints-001",
            "context": {
                "trusted": {
                    "projectPath": "/tmp/project",
                    "buildTargetPath": "gateway",
                    "buildTargetName": "gateway",
                },
            },
            "constraints": {
                "maxTokens": 32768,
                "enableThinking": False,
                "temperature": 0.7,
                "topP": 0.85,
                "topK": -1,
                "minP": 0.15,
                "presencePenalty": 0.3,
                "repetitionPenalty": 1.05,
            },
        },
    )

    assert response.status_code == 200
    constraints = captured["constraints"]
    assert constraints.maxTokens == 32768
    assert constraints.enableThinking is False
    assert constraints.temperature == 0.7
    assert constraints.topP == 0.85
    assert constraints.topK == -1
    assert constraints.minP == 0.15
    assert constraints.presencePenalty == 0.3
    assert constraints.repetitionPenalty == 1.05


def test_build_route_rejects_snake_case_generation_constraints(client) -> None:
    response = client.post(
        "/v1/tasks",
        json={
            "taskType": "build-resolve",
            "taskId": "build-contract-http-constraints-bad-001",
            "context": {
                "trusted": {
                    "projectPath": "/tmp/project",
                    "buildTargetPath": "gateway",
                    "buildTargetName": "gateway",
                },
            },
            "constraints": {"top_p": 0.8},
        },
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any("top_p" in str(item.get("loc", ())) for item in detail)


def test_build_route_rejects_max_tokens_above_32768(client) -> None:
    response = client.post(
        "/v1/tasks",
        json={
            "taskType": "build-resolve",
            "taskId": "build-contract-http-max-001",
            "context": {
                "trusted": {
                    "projectPath": "/tmp/project",
                    "buildTargetPath": "gateway",
                    "buildTargetName": "gateway",
                },
            },
            "constraints": {"maxTokens": 32769},
        },
    )

    assert response.status_code == 422
