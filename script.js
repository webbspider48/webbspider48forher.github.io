/* =========================
   HOME PAGE
========================= */

function showNotification() {

    const notification =
        document.getElementById("notification");

    if (notification) {

        notification.classList.add("show");

    }

}


function closeNotification() {

    const notification =
        document.getElementById("notification");

    if (notification) {

        notification.classList.remove("show");

    }

}


function openLetter() {

    window.location.href = "letter.html";

}


/* =========================
   LETTER PAGE
========================= */

function openAssessment() {

    window.location.href = "assessment.html";

}


/* =========================
   BOOT SCREEN
========================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const bootScreen =
            document.getElementById("boot-screen");

        const desktop =
            document.getElementById("desktop");

        const progress =
            document.getElementById("boot-progress");

        const status =
            document.getElementById("boot-status");


        if (
            bootScreen &&
            desktop &&
            progress &&
            status
        ) {

            let amount = 0;


            const messages = [

                "Initialising...",

                "Loading desktop...",

                "Checking messages...",

                "Preparing something special...",

                "Almost ready..."

            ];


            const loader =
                setInterval(
                    function () {

                        amount += 4;


                        progress.style.width =
                            amount + "%";


                        const index =
                            Math.floor(
                                amount / 20
                            );


                        if (
                            messages[index]
                        ) {

                            status.textContent =
                                messages[index];

                        }


                        if (amount >= 100) {

                            clearInterval(loader);


                            setTimeout(
                                function () {

                                    bootScreen
                                        .classList
                                        .add("hidden");

                                    desktop
                                        .classList
                                        .remove("hidden");

                                },
                                300
                            );

                        }

                    },
                    45
                );

        }

    }
);


/* =========================
   RISK ASSESSMENT
========================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const analysisScreen =
            document.getElementById(
                "analysis-screen"
            );

        const assessmentResult =
            document.getElementById(
                "assessment-result"
            );

        const progress =
            document.getElementById(
                "analysis-progress"
            );

        const analysisText =
            document.getElementById(
                "analysis-text"
            );


        if (
            analysisScreen &&
            assessmentResult &&
            progress &&
            analysisText
        ) {

            let amount = 0;


            const messages = [

                "Checking message status...",

                "Reviewing emotional exposure...",

                "Assessing communication risk...",

                "Identifying mitigation strategy...",

                "Finalising assessment..."

            ];


            const analysis =
                setInterval(
                    function () {

                        amount += 5;


                        progress.style.width =
                            amount + "%";


                        const index =
                            Math.floor(
                                amount / 20
                            );


                        if (
                            messages[index]
                        ) {

                            analysisText.textContent =
                                messages[index];

                        }


                        if (amount >= 100) {

                            clearInterval(analysis);


                            analysisText.textContent =
                                "Assessment complete.";


                            setTimeout(
                                function () {

                                    analysisScreen
                                        .classList
                                        .add("hidden");

                                    assessmentResult
                                        .classList
                                        .remove("hidden");

                                },
                                700
                            );

                        }

                    },
                    100
                );

        }

    }
);


/* =========================
   FINAL STATUS
========================= */

function showFinalMessage() {

    const assessmentResult =
        document.getElementById(
            "assessment-result"
        );

    const finalMessage =
        document.getElementById(
            "final-message"
        );


    if (
        assessmentResult &&
        finalMessage
    ) {

        assessmentResult
            .classList
            .add("hidden");

        finalMessage
            .classList
            .remove("hidden");

    }

}
