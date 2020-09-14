function LCSLength(X, Y, cmp) {
    let m = X.length;
    let n = Y.length;
    let C = [];
    for (var i = 0; i <= m; i++) {
        C.push([]);
        for (var j = 0; j <= n; j++) {
            C[i].push(0);
        }
    }

    for (var i = 1; i <= m; i++) {
        for (var j = 1; j <= n; j++) {
            if (cmp(X[i-1], Y[j-1])) {
                C[i][j] = C[i-1][j-1] + 1
            } else {
                C[i][j] = Math.max(C[i][j-1], C[i-1][j])
            }
        }
    }

    return C;
}

function printDiff(C, X, Y, i, j, arr) {
    if (typeof arr === "undefined") {
        arr = [];
    }

    if (i > 0 && j > 0 && C[i-1][j-1] == C[i-1][j] && C[i-1][j-1] == C[i][j-1]) {
        printDiff(C, X, Y, i-1, j-1, arr);
        if (X[i-1] != Y[j-1]) {
            arr.push([-1, X[i-1]]);
            // console.log("- " + X[i-1]);
            arr.push([1, Y[j-1]]);
            // console.log("+ " + Y[j-1]);
        } else {
            arr.push([0, X[i-1]]);
            // console.log("  " + X[i-1]);
        }
    } else if (j > 0 && (i == 0 || C[i][j-1] >= C[i-1][j])) {
        printDiff(C, X, Y, i, j-1, arr);
        arr.push([1, Y[j-1]]);
        // console.log("+ " + Y[j-1]);
    } else if (i > 0 && (j == 0 || C[i][j-1] < C[i-1][j])) {
        printDiff(C, X, Y, i-1, j, arr);
        arr.push([-1, X[i-1]]);
        // console.log("- " + X[i-1]);
    }
    return arr;
}

function diff(X, Y, cmp) {
    if (typeof cmp === "undefined") {
        cmp = (a, b) => a == b;
    }
    return printDiff(LCSLength(X, Y, cmp), X, Y, X.length, Y.length);
}
