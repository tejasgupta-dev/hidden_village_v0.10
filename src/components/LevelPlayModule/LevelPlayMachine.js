import { createMachine } from "xstate";

const LevelPlayMachine = createMachine({
  id: "levelPlay",
  initial: "introDialogue",
  on: {
    RESET_CONTEXT: "introDialogue"
  },
  states: {
    introDialogue: {
      on: {
        // When the chapter machine signals that the intro is complete,
        // transition from introDialogue to tween.
        NEXT: "tween"
      },
    },

    tween: {
      on: {
        NEXT: "poseMatching"
      }
    },

    poseMatching: {
      on: {
        NEXT: "intuition"
      },
    },

    intuition: {
      on: {
        NEXT: "insight",
      },
    },

    insight: {
      on: {
        NEXT: "mcq",
      },
    },

    mcq: {
      on: {
        NEXT: "outroDialogue",
      },
    },

    outroDialogue: {
      on: {
        NEXT: "levelEnd",
      },
    },

     levelEnd: {
      on: {
        // allow an explicit reset
        RESET_CONTEXT: "introDialogue"
      }
    }
  },
});

export default LevelPlayMachine;
