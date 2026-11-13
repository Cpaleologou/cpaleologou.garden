---
title: >-
  Multiplying Two Matrices Is The Math Behind Applying Two Transformations To A
  Vector
tags:
  - '#Math'
  - '#LinearAlgebra'
publish: 'true'
date: 2026-08-06T00:00:00.000Z
---
Sometimes, you want to apply two, or a series, of linear transformations to a grid, or vector. The end result is, in itself, a matrix, which is represented by the ending positions of î and ĵ. 
You can end up at the final matrix of  î and ĵ (or the final vector) by multiplying the matrix of the first transformation and the second transformation.

![[composed_linear_transformations_with_matrices.webp]]

---

## Connections

[[Scaling Means To Multiply A Vector]]

**Link Explanation:**
Note that scaling a vector is not exactly the same as multiplying two matrices. I could see how these get confused though. Scaling means to multiple a vector by a value. This stretches the vector itself, but *does not* change the basis vectors.
Matrix, instead, represents the ending position of the basis vectors after a shift or flip (linear transformation) has been applied to the span (entire grid space). Mutliplying a matrix by another matrix then, represents the basis vector position after two distinct linear transformations on the original grid.

---

## Reference

https://www.youtube.com/watch?v=XkY2DOUCWMU&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab&index=4
