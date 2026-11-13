---
title: The Determinate Of A Matrix Measures The Change In Area Of A Square On A Grid
tags:
  - '#LinearAlgebra'
  - '#Math'
publish: 'true'
date: 2026-08-06T00:00:00.000Z
---
When a linear transformation is applied to a grid, it shifts or flips, or scales the grid (span). You can imagine the amount of change, by measuring the changing in the area of the origin-basis-vector square.
For example, since the original square of î and ĵ is 1 (1 x 1), a matrix of $\begin{bmatrix} 2 & 0 \\ 0 & 2 \end{bmatrix}$ would scale it to 2x2. The area determinate in therefore 4, since the area of the origin square grew by 4x. 
Since linear transformations keep each line on the grid evenly spaced and parallel, it means that we can measure the change in *any* square or set of squares on the grid through the determinate. 
It also means that we can measure the change of any non-square object on the grid, by approximating its shape with many small squares and determining how the area of those tiny squares changed by the determinate.

![[determinant_area_scaling.webp]]

The determinate for a 2x2 matrix can be calculated with the following formula: 

$det(\begin{bmatrix} a & b \\ c & d \end{bmatrix}) = ad - bc$ 

---

## Connections

[[Basis Vectors Are The 1s Of The XY Coordinate System]]

**Link Explanation:**
Once you know that basis vectors are the arbitrary 1s of the grid, you can understand how the scaling or shifting of the grid changes the area of basis vector square. This is the entire idea behind the determinate and can be used to closely estimate the effect that the matrix has on any shape on the grid.

---

## Reference

https://www.youtube.com/watch?v=Ip3X9LOh2dk&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab&index=6
