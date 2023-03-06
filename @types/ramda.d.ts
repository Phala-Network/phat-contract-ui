import 'ramda'
import { Path } from 'ramda';

declare module 'ramda' {
  export function modifyPath<T extends object, A extends unknown, P extends unknown, R extends object>(
    props: Path,
    fn: (a: A) => P,
    obj: T,
  ): R
  export function modifyPath<A extends unknown, P extends unknown>(
    props: Path,
    fn: (a: A) => P,
  ): <T extends object, R extends T>(target: T) => R
}