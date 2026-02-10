import { handsum, type Handsum } from 'handsum';

interface TPatternF<Ann> {
  Ctor(name: string, args: string[], ann: Ann): PatternF<Ann>;
}

interface IPatternF<_Ann> {}

export type PatternF<Ann> = Handsum<TPatternF<Ann>, IPatternF<Ann>>;

const PatternCtor = <Ann>() => handsum<TPatternF<Ann>, IPatternF<Ann>>({});

export const Pattern = {
  Ctor: <A>(name: string, args: string[], ann: A): PatternF<A> =>
    PatternCtor<A>().Ctor(name, args, ann),
};
