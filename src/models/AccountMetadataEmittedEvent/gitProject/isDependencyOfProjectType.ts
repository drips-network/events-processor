import type { AnyVersion } from '@efstajas/versioned-parser';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type { ProjectId } from '../../../common/types';

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

type Dependencies = ArrayElement<
  AnyVersion<typeof repoDriverAccountMetadataParser>['splits']['dependencies']
>;

export type DependencyOfProjectType = {
  type: 'repoDriver';
  accountId: ProjectId;
  source: {
    forge: 'github';
    repoName: string;
    ownerName: string;
    url: string;
  };
  weight: number;
};

export default function isDependencyOfProjectType(
  dependency: Dependencies,
): dependency is DependencyOfProjectType {
  return 'source' in dependency;
}
