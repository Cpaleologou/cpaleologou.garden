---
title: 'Linear Combinations Cover The Entire Space, Usually'
tags:
  - '#LinearAlgebra'
  - '#Math'
publish: 'true'
date: 2026-08-04T00:00:00.000Z
---
Anytime that you are scaling your basis vectors and adding them together, it is called a "linear combination" of those two vectors. And, the set of all possible combinations of linear combinations that you can put together on a graph is called a "span".

In theory, the span of two vectors can cover the entire 2D (or 3D, if using 3 vectors) space. Unless one of two possible situations occur.
1. Both vectors are $\begin{bmatrix} 0 \\ 0 \end{bmatrix}$. In which case, you are just stuck at the origin. Or,
2. A vector is a direct multiple of the other. Like, $\begin{bmatrix} 2 \\ 1 \end{bmatrix} + \begin{bmatrix} 4 \\ 2 \end{bmatrix}$. In that case, they are effectively a straight line. Scaling them can only result in a straight line in either direction. And, one of them is redundant. The terminology for this is that they are "linearly dependent".

If a vector does add another dimension to the span, that is it allows for a new point on the graph (not one of the 2 situations above), it is called linearly independent.

![[span_full_vs_degenerate_v2.webp]]

---

## Connections

[[Basis Vectors Are The 1s Of The XY Coordinate System]]

**Link Explanation:**
Once you understand that vectors are scalars of the basis vectors, you can understand that the span, the range of possible combinations, covers the entire graph. Unless, under the rare circumstance that your "randomly chosen" vectors are direct multiples or both 0. Once concept builds directly on the other.

---

## Reference

https://www.youtube.com/watch?v=k7RM-ot2NWY&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab&index=2
