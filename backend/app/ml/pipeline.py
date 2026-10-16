from __future__ import annotations

import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import GroupShuffleSplit

model_registry: dict = {"status": "untrained", "accuracy": None, "samples": 0, "classifier": None, "isolation": None}


def build_training_data(seed: int = 91, trajectories: int = 42, per_trajectory: int = 90):
    rng = np.random.default_rng(seed); xs=[]; ys=[]; groups=[]
    for trajectory_id in range(trajectories):
        base_noise=rng.uniform(.08,.9)
        previous=rng.uniform(2,16)
        for _ in range(per_trajectory):
            corrupted=rng.random()<rng.uniform(.08,.42)
            change=abs(rng.normal(1.25 if corrupted else .16,.35 if corrupted else .1))
            motion=abs(rng.normal(2.1 if corrupted else .22,.65 if corrupted else .14))
            variance=abs(rng.normal(.85 if corrupted else .12,.25 if corrupted else .06))
            missing_streak=int(rng.random()<.08)*rng.integers(1,4)
            current=max(.05,previous+rng.normal(0,base_noise)+(rng.uniform(1.2,3.5) if corrupted else 0))
            xs.append([current,change,motion,variance,missing_streak,base_noise]);ys.append(int(corrupted));groups.append(trajectory_id);previous=current
    return np.asarray(xs),np.asarray(ys),np.asarray(groups)


def train_models(seed: int = 91) -> dict:
    x,y,groups=build_training_data(seed)
    splitter=GroupShuffleSplit(n_splits=1,test_size=.24,random_state=seed)
    train_idx,test_idx=next(splitter.split(x,y,groups))
    classifier=RandomForestClassifier(n_estimators=120,max_depth=8,class_weight="balanced",random_state=seed,n_jobs=-1)
    classifier.fit(x[train_idx],y[train_idx])
    isolation=IsolationForest(n_estimators=100,contamination=.22,random_state=seed,n_jobs=-1).fit(x[train_idx])
    pred=classifier.predict(x[test_idx]);accuracy=float(accuracy_score(y[test_idx],pred))
    precision,recall,f1,_=precision_recall_fscore_support(y[test_idx],pred,average="binary",zero_division=0)
    model_registry.update(status="trained",accuracy=accuracy,samples=len(x),classifier=classifier,isolation=isolation,confusion_matrix=confusion_matrix(y[test_idx],pred).tolist(),metrics={"precision":float(precision),"recall":float(recall),"f1":float(f1)},feature_importance=classifier.feature_importances_.tolist())
    return {k:v for k,v in model_registry.items() if k not in {"classifier","isolation"}}
