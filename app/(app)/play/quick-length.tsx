import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter } from 'expo-router';
import { BORDER_RADIUS, SPACING, LAYOUT, FONTS } from '@/constants';
import { SOFT_SURFACE_STYLES } from '@/features/play/styles/softSurface';
import { isActiveMatchStep, routeForPlayStep } from '@/features/play/sessionRouting';
import {
  QUICK_PLAY_TOPIC_OPTIONS,
  getGameTokenCost,
  type QuickPlayTopicCount,
} from '@/features/play/tokenCosts';
import { useI18n } from '@/lib/i18n/useI18n';
import { useDarkModeFlatTop } from '@/lib/hooks/useTheme';
import { useViewportLayout } from '@/lib/hooks/useViewportLayout';
import { usePlayStore } from '@/store/play';
import { goBackOrReplace } from '@/lib/navigation/goBackOrReplace';
import type { SupportedLocale } from '@/lib/i18n/config';
import { PlayScaffold } from '@/features/play/components/PlayScaffold';
import { getPlaySurfaceColors } from '@/features/play/playSurfaceColors';
import { useThemeStore } from '@/store/theme';

const QUICK_LENGTH_LABEL_KEYS = {
  1: 'play.quickLength.option1',
  2: 'play.quickLength.option2',
  3: 'play.quickLength.option3',
  4: 'play.quickLength.option4',
  5: 'play.quickLength.option5',
} as const satisfies Record<QuickPlayTopicCount, string>;

const QUICK_LENGTH_COPY_KEYS = {
  1: 'play.quickLength.option1Copy',
  2: 'play.quickLength.option2Copy',
  3: 'play.quickLength.option3Copy',
  4: 'play.quickLength.option4Copy',
  5: 'play.quickLength.option5Copy',
} as const satisfies Record<QuickPlayTopicCount, string>;

/** Web-only option tile with hover tracking - extracted to keep hooks at top level. */
function OptionTile({
  option,
  isWeb,
  compact,
  tokenLabel,
  tokensText,
  getTextStyle,
  onSelect,
}: {
  option: { count: number; tokenCost: number; label: string; copy: string };
  isWeb: boolean;
  compact: boolean;
  tokenLabel: string;
  tokensText: string;
  getTextStyle: (
    locale?: SupportedLocale,
    role?: 'body' | 'bodyMedium' | 'bodySemibold' | 'bodyBold' | 'display' | 'displayBold',
    edge?: 'start' | 'center' | 'end'
  ) => Pick<TextStyle, 'fontFamily' | 'writingDirection' | 'textAlign'>;
  onSelect: (count: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const darkModeFlatTop = useDarkModeFlatTop();
  useThemeStore((state) => state.paletteId);
  const surfaceColors = getPlaySurfaceColors();

  return (
    <Pressable
      key={option.count}
      onPointerEnter={isWeb ? () => setHovered(true) : undefined}
      onPointerLeave={isWeb ? () => setHovered(false) : undefined}
      style={({ pressed }) => [
        styles.optionCard,
        isWeb ? styles.optionCardWeb : compact ? styles.optionCardCompact : styles.optionCardNative,
        SOFT_SURFACE_STYLES.face,
        darkModeFlatTop,
        SOFT_SURFACE_STYLES.raised,
        { backgroundColor: surfaceColors.controlBackground },
        isWeb && hovered && { backgroundColor: surfaceColors.hoverSurface },
        pressed && styles.optionCardPressed,
      ]}
      onPress={() => onSelect(option.count)}
      accessibilityRole="button"
      accessibilityLabel={`${option.label}, ${option.tokenCost} ${tokensText.toLowerCase()}`}
      accessibilityHint={option.copy}
    >
      <Text
        style={[
          styles.optionTitle,
          isWeb
            ? styles.optionTitleWeb
            : compact
              ? styles.optionTitleCompact
              : styles.optionTitleNative,
          { color: surfaceColors.textPrimary },
          getTextStyle(undefined, 'displayBold', 'center'),
        ]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {option.label}
      </Text>
      <View style={[styles.tokenCostRow, isWeb && styles.tokenCostRowWeb]}>
        <Ionicons
          name="diamond"
          size={isWeb ? 13 : compact ? 10 : 12}
          color={surfaceColors.textPrimary}
        />
        <Text
          testID={`quick-length-token-cost-${option.count}`}
          style={[
            styles.tokenCostText,
            isWeb
              ? styles.tokenCostTextWeb
              : compact
                ? styles.tokenCostTextCompact
                : styles.tokenCostTextNative,
            { color: surfaceColors.textPrimary },
            getTextStyle(undefined, 'bodyBold', 'center'),
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {`${option.tokenCost} ${tokenLabel}`}
        </Text>
      </View>
    </Pressable>
  );
}

export default function QuickLengthScreen() {
  const router = useRouter();
  const viewport = useViewportLayout();
  const { t, getTextStyle } = useI18n();
  const sessionStep = usePlayStore((state) => state.session?.step);
  const sessionMode = usePlayStore((state) => state.session?.mode);
  const setQuickPlayTopicCount = usePlayStore((state) => state.setQuickPlayTopicCount);
  const setTopicCount = usePlayStore((state) => state.setTopicCount);
  const isWeb = Platform.OS === 'web';
  const compact = viewport.height < 720;
  const setupMaxWidth = viewport.contentMaxWidth('setup');
  const tokensText = t('common.tokens');
  const tokenLabel = tokensText.toUpperCase();
  const isRandomizerQp = sessionMode === 'random';
  const options = QUICK_PLAY_TOPIC_OPTIONS.map(({ topicCount, tokenCost }) => ({
    count: topicCount,
    tokenCost: isRandomizerQp ? getGameTokenCost('random', topicCount) : tokenCost,
    label: t(QUICK_LENGTH_LABEL_KEYS[topicCount]),
    copy: t(QUICK_LENGTH_COPY_KEYS[topicCount]),
  }));

  // History/back can land here while a board is live; send players back to leave from the match UI.
  useEffect(() => {
    if (!isActiveMatchStep(sessionStep) || !sessionStep) return;
    const target = routeForPlayStep(sessionStep);
    if (target) {
      router.replace(target);
    }
  }, [router, sessionStep]);

  const handleBack = useCallback(() => {
    if (sessionMode === 'random') {
      goBackOrReplace(router, '/play/team-setup');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/');
    }
  }, [router, sessionMode]);

  const handleSelect = useCallback(
    (count: number) => {
      if (isActiveMatchStep(sessionStep)) {
        return;
      }
      if (sessionMode === 'random') {
        setTopicCount(count);
        goBackOrReplace(router, '/play/team-setup');
        return;
      }
      setQuickPlayTopicCount(count);
      router.push('/play/team-setup');
    },
    [router, sessionMode, sessionStep, setQuickPlayTopicCount, setTopicCount]
  );

  return (
    <PlayScaffold
      title={t(isRandomizerQp ? 'play.randomizerQuickPlayChoose' : 'play.quickLengthTitle')}
      subtitle={isRandomizerQp ? undefined : t('play.quickLengthSubtitle')}
      onBack={handleBack}
      backVariant="icon"
      bodyFrame={false}
      bodyScrollEnabled={false}
      contentMaxWidth={isWeb ? setupMaxWidth : undefined}
    >
      <View
        style={[
          styles.listWrap,
          isWeb && styles.listWrapWeb,
          { justifyContent: viewport.mainJustify },
        ]}
      >
        <View
          style={[
            styles.list,
            isWeb ? styles.listWeb : styles.listNative,
            isWeb && { maxWidth: setupMaxWidth },
          ]}
        >
          {options.map((option) => (
            <OptionTile
              key={option.count}
              option={option}
              isWeb={isWeb}
              compact={compact}
              tokenLabel={tokenLabel}
              tokensText={tokensText}
              getTextStyle={getTextStyle}
              onSelect={handleSelect}
            />
          ))}
        </View>
      </View>
    </PlayScaffold>
  );
}

const styles = StyleSheet.create({
  /* ── List wrapper ── */
  listWrap: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  listWrapWeb: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  /** 1 → 5 topics left to right in a single row. */
  list: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  listNative: {
    flex: 1,
    minHeight: 0,
    gap: SPACING.xs,
    maxHeight: 220,
    alignSelf: 'center',
  },
  listWeb: {
    maxWidth: LAYOUT.setupMaxWidth,
    gap: 14,
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    minHeight: 160,
    maxHeight: 200,
  },

  /* ── Option card ── */
  optionCard: {
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  optionCardNative: {
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  optionCardCompact: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 4,
    paddingVertical: SPACING.sm,
  },
  optionCardWeb: {
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 22,
    minHeight: 140,
  },
  optionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  /* ── Option title ── */
  optionTitle: {
    fontFamily: FONTS.displayBold,
    marginBottom: SPACING.xs,
    textAlign: 'center',
    width: '100%',
  },
  optionTitleNative: {
    fontSize: 15,
    lineHeight: 18,
  },
  optionTitleCompact: {
    fontSize: 12,
    lineHeight: 14,
    marginBottom: 2,
  },
  optionTitleWeb: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 8,
  },

  /* ── Token cost row ── */
  tokenCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    flexWrap: 'wrap',
  },
  tokenCostRowWeb: {
    gap: 5,
  },
  tokenCostText: {
    fontFamily: FONTS.uiBold,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tokenCostTextNative: {
    fontSize: 10,
    lineHeight: 13,
  },
  tokenCostTextCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
  tokenCostTextWeb: {
    fontSize: 13,
    lineHeight: 16,
  },
});
