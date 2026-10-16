# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, React Router, Zustand, TanStack Query, and native SVG on the frontend; Python, FastAPI, Pydantic, NumPy, SciPy, pandas, and scikit-learn on the backend. The supplied brief delegates implementation details inside that stack.

## Users

Primary users are hackathon judges evaluating an indoor-positioning AI/ML solution under time pressure. Secondary users are the Byte Benders team and technical reviewers who need to challenge the simulator, inspect measurements, compare algorithms, and reproduce results.

## Product Purpose

LOCUS AI estimates a moving tag's two-dimensional indoor position when fixed-anchor measurements are sparse, noisy, missing, or biased. Success means users can alter signal conditions and immediately observe honest, computed changes in estimates, uncertainty, anchor trust, and comparative accuracy.

## Positioning

Spatial intelligence when signals cannot be trusted: a reliability-aware localization workbench that combines robust optimization, causal motion history, anomaly evidence, and explicit uncertainty rather than presenting a decorative moving dot.

## Operating Context

The core workflow is a reproducible 20 × 15 metre room simulation with four wireless anchors and one moving tag. Users play or step the simulation, introduce noise and failures, inspect live anchor evidence, compare baseline and reliability-aware estimates, run experiments, generate or upload datasets, and present a guided judge demo.

## Capabilities and Constraints

- Ground truth may generate measurements and score estimates, but never enters localization or inference features.
- The default scenario must be useful immediately and deterministic under the same seed.
- The app must expose real simulator, localization, temporal filtering, uncertainty, anomaly, classification, experiment, dataset, and export behavior.
- Estimates must report degraded or insufficient geometry rather than false precision.
- No paid API or physical ESP32 hardware is required for the initial implementation.
- The system estimates a tag associated with a person; it does not identify people biometrically.

## Brand Commitments

The product name is LOCUS AI. The voice is precise, candid, technically literate, and judge-friendly. Binding visual constraints include square geometry, Space Grotesk plus IBM Plex Mono only, a dark charcoal/graphite base, restrained cyan and lime positioning signals, amber and coral warnings, controlled translucency, and no generic purple-blue AI styling.

## Evidence on Hand

The supplied master build prompt is the product specification. The application may create reproducible synthetic data and must label it as synthetic. No real deployment benchmarks, customer claims, testimonials, or physical-hardware measurements were supplied and none may be fabricated.

## Product Principles

- Compute every visible technical result from the current scenario.
- Make degraded geometry and uncertainty legible, not embarrassing.
- Let users break the system deliberately and see the consequences instantly.
- Keep the judge path fast while preserving depth for technical inspection.
- Prefer a functioning smaller method over a visually impressive fake.

## Accessibility & Inclusion

Meaning must never depend on color alone. Interactive controls require keyboard focus, readable contrast, reduced-motion support, and responsive layouts for laptop and tablet screens.
