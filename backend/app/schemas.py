from pydantic import BaseModel, Field


class SimulationConfig(BaseModel):
    noise: float = Field(0.30, ge=0.0, le=3.0)
    nlos_probability: float = Field(0.18, ge=0.0, le=1.0)
    missing_probability: float = Field(0.08, ge=0.0, le=1.0)
    speed: float = Field(1.0, ge=0.1, le=4.0)
    seed: int = Field(41, ge=0, le=1_000_000)
    disabled_anchors: list[str] = Field(default_factory=list)


class CreateSimulation(BaseModel):
    config: SimulationConfig | None = None


class EstimateRequest(BaseModel):
    anchors: list[dict]
    method: str = "locus"
    prior: dict | None = None


class ExperimentRequest(BaseModel):
    noise: float = Field(0.55, ge=0.0, le=3.0)
    nlos_probability: float = Field(0.25, ge=0.0, le=1.0)
    missing_probability: float = Field(0.10, ge=0.0, le=1.0)
    seed: int = 73
    samples: int = Field(120, ge=20, le=1000)


class DatasetRequest(BaseModel):
    rows: int = Field(800, ge=40, le=100_000)
    seed: int = 41
