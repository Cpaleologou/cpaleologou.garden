---
title: Linear Transformations Are Described By The Change In The Basis Vectors
tags:
  - '#LinearAlgebra'
  - '#Math'
publish: 'true'
date: 2026-08-05T00:00:00.000Z
---
Linear transformations **do not** change the vector. They change the values of î and ĵ. So, if you have a vector $\begin{bmatrix} -1 \\ 2 \end{bmatrix}$, which means -1î + 2ĵ, transforming the vector, keeps the formula the same. It is the basis vectors (î and ĵ) that  dictate the ending vector.

![[DeducingTransformedVectors.webp]]

This means that you can deduce the final vector, by observing only how much the basis vectors shifted. See the image above. The grey grid is the original, and the blue is the transformed. 

î, which was originally $\begin{bmatrix} 1 \\ 0 \end{bmatrix}$, shifted to $\begin{bmatrix} 1 \\ -2 \end{bmatrix}$. 
ĵ, which was originally $\begin{bmatrix} 0 \\ 1 \end{bmatrix}$, shifted to $\begin{bmatrix} 3 \\ 0 \end{bmatrix}$.

Since the original vector  $\begin{bmatrix} -1 \\ 2 \end{bmatrix}$, means -1î + 2ĵ, we can plug the new basis vector coordinates into the respective variables î and ĵ, to get the location of the transformed vector.

 $-1\begin{bmatrix} 1 \\ -2 \end{bmatrix} + 2\begin{bmatrix} 3 \\ 0 \end{bmatrix} = \begin{bmatrix} -1 \\ 2 \end{bmatrix} + \begin{bmatrix} 6 \\ 0 \end{bmatrix} = \begin{bmatrix} 5 \\ 2 \end{bmatrix}$

That means all 2D linear transformations can be described, only requiring the ending positions of î  and ĵ. In fact, this is what a 2x2 matrix represents.

![[2x2MatrixIsFinalIhatandJhat.webp]]

---

## Connections

[[Basis Vectors Are The 1s Of The XY Coordinate System]]

**Link Explanation:**
The basis vectors are the 1s of the grid. Transforming the grid therefore, only changes the size of the basis vectors. As described above, we can calculate the ending position of the transformed vector, by just knowing the ending positions of the basis vectors, because the vector itself stays the same after the transformation is applied.

---

## Reference

https://www.youtube.com/watch?v=kYB8IZa5AuE&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab&index=3
