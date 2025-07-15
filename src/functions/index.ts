import authentication from "./authentication";
import saves from "./saves";


export const functions = {
  ...authentication,
  ...saves
};

export type Ifunctions = typeof functions;