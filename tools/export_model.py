import ast
import base64
import json
from pathlib import Path

import joblib
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
MODEL_PATH = Path(r"C:\Users\Dell\Downloads\plant_app\plant_app\models\plant_model.pkl")
ENCODER_PATH = Path(r"C:\Users\Dell\Downloads\plant_app\plant_app\models\label_encoder.pkl")
APP_PATH = Path(r"C:\Users\Dell\Downloads\plant_app\plant_app\app.py")


def encode_array(values, dtype):
    array = np.ascontiguousarray(values, dtype=dtype)
    return base64.b64encode(array.tobytes()).decode("ascii")


def read_disease_info():
    module = ast.parse(APP_PATH.read_text(encoding="utf-8"))
    for node in module.body:
        if isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == "DISEASE_INFO" for target in node.targets):
                return ast.literal_eval(node.value)
    raise RuntimeError("DISEASE_INFO was not found")


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    model = joblib.load(MODEL_PATH)
    encoder = joblib.load(ENCODER_PATH)

    if model.n_features_in_ != 532:
        raise RuntimeError(f"Expected 532 features, found {model.n_features_in_}")
    if model.estimators_.shape != (model.n_estimators, model.n_classes_):
        raise RuntimeError(f"Unexpected estimator shape: {model.estimators_.shape}")

    trees = []
    for estimator in model.estimators_.flat:
        tree = estimator.tree_
        if tree.node_count > np.iinfo(np.int16).max:
            raise RuntimeError("Tree is too large for compact int16 encoding")
        trees.append({
            "n": int(tree.node_count),
            "l": encode_array(tree.children_left, "<i2"),
            "r": encode_array(tree.children_right, "<i2"),
            "f": encode_array(tree.feature, "<i2"),
            "t": encode_array(tree.threshold, "<f8"),
            "v": encode_array(tree.value[:, 0, 0], "<f8"),
        })

    init_raw = model._raw_predict_init(np.zeros((1, model.n_features_in_)))[0]
    model_data = {
        "type": "GradientBoostingClassifier",
        "nFeatures": int(model.n_features_in_),
        "nClasses": int(model.n_classes_),
        "nStages": int(model.n_estimators),
        "learningRate": float(model.learning_rate),
        "initRaw": init_raw.tolist(),
        "labels": [str(value) for value in encoder.classes_],
        "trees": trees,
    }
    (ASSETS / "plant-model.json").write_text(
        json.dumps(model_data, separators=(",", ":")), encoding="utf-8"
    )

    disease_data = read_disease_info()
    (ASSETS / "diseases-en.json").write_text(
        json.dumps(disease_data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    print(f"Exported {len(trees)} trees and {len(model_data['labels'])} labels")
    print(f"Model asset: {(ASSETS / 'plant-model.json').stat().st_size} bytes")


if __name__ == "__main__":
    main()
