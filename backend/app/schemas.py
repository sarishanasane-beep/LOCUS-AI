from pydantic import BaseModel, Field


class SimulationConfig(BaseModel):
    noise: float = Field(0.30, ge=0.0, le=3.0)
    nlos_probability: float = Field(0.18, ge=0.0, le=1.0)
    missing_probability: float = Field(0.08, ge=0.0, le=1.0)
    speed: float = Field(1.0, ge=0.1, le=4.0)
    seed: int = Field(41, ge=0, le=1_000_000)
    anchor_count: int = Field(4, ge=3, le=8)
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
    anchor_count: int = Field(4, ge=3, le=8)


class DensityExperimentRequest(BaseModel):
    condition: str = Field("moderate", pattern="^(clean|moderate|heavy_nlos|severe)$")
    anchor_counts: list[int] = Field(default_factory=lambda: [3, 4, 6, 8])
    samples: int = Field(120, ge=20, le=500)
    seed: int = 73


class ForecastingExperimentRequest(BaseModel):
    samples: int = Field(120, ge=20, le=500)
    seed: int = 73
    noise: float = Field(0.35, ge=0.0, le=3.0)
    nlos_probability: float = Field(0.20, ge=0.0, le=1.0)
    missing_probability: float = Field(0.10, ge=0.0, le=1.0)
    anchor_count: int = Field(4, ge=3, le=8)


class DatasetRequest(BaseModel):
    rows: int = Field(800, ge=40, le=100_000)
    seed: int = 41
    anchor_count: int = Field(4, ge=3, le=8)
    noise: float = Field(0.30, ge=0.0, le=3.0)
    nlos_probability: float = Field(0.18, ge=0.0, le=1.0)
    missing_probability: float = Field(0.08, ge=0.0, le=1.0)
