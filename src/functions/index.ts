import authentication from "./authentication";
import saves from "./saves";


export const functions = {
  ...authentication,
};

export type Ifunctions = typeof functions;