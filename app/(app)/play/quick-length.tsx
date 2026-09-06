import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter } from 'expo-router';
import { FONTS } from '@/constants';
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
import { getQuickLengthOptionLayout, type QuickLengthOptionLayout } from '@/lib/layout/quickLengthLayout';
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
  layout,
  tokenLabel,
  tokensText,
  getTextStyle,
  onSelect,
}: {
  option: { count: number; tokenCost: number; label: string; copy: string };
  isWeb: boolean;
  layout: QuickLengthOptionLayout;
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
        SOFT_SURFACE_STYLES.face,
        darkModeFlatTop,
        SOFT_SURFACE_STYLES.raised,
        {
          width: layout.cardW,
          height: layout.cardH,
          borderRadius: layout.radius,
          paddingHorizontal: layout.padH,
          paddingVertical: layout.padV,
          backgroundColor: surfaceColors.controlBackground,
        },
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
          {
            color: surfaceColors.textPrimary,
            fontSize: layout.titleSize,
            lineHeight: layout.titleLine,
            marginBottom: layout.titleMargin,
          },
          getTextStyle(undefined, 'displayBold', 'center'),
        ]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {option.label}
      </Text>
      <View style={[styles.tokenCostRow, { gap: Math.max(3, Math.round(layout.iconSize * 0.4)) }]}>
        <Ionicons
          name="diamond"
          size={layout.iconSize}
          color={surfaceColors.textPrimary}
        />
        <Text
          testID={`quick-length-token-cost-${option.count}`}
          style={[
            styles.tokenCostText,
            {
              color: surfaceColors.textPrimary,
              fontSize: layout.tokenSize,
              lineHeight: layout.tokenLine,
            },
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
  const insets = useSafeAreaInsets();
  const { t, getTextStyle } = useI18n();
  const sessionStep = usePlayStore((state) => state.session?.step);
  const sessionMode = usePlayStore((state) => state.session?.mode);
  const setQuickPlayTopicCount = usePlayStore((state) => state.setQuickPlayTopicCount);
  const setTopicCount = usePlayStore((state) => state.setTopicCount);
  const isWeb = Platform.OS === 'web';
  const layout = useMemo(
    () =>
      getQuickLengthOptionLayout({
        width: viewport.width,
        height: viewport.height,
        insets,
        isWeb,
      }),
    [insets, isWeb, viewport.height, viewport.width]
  );
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
            {
              width: layout.rowWidth,
              maxWidth: layout.rowWidth,
              gap: layout.gap,
            },
          ]}
        >
          {options.map((option) => (
            <OptionTile
              key={option.count}
              option={option}
              isWeb={isWeb}
              layout={layout}
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
  listWrap: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  listWrapWeb: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  /** 1 to 5 topics left to right in a single row. */
  list: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  optionCard: {
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    minHeight: 0,
  },
  optionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  optionTitle: {
    fontFamily: FONTS.displayBold,
    textAlign: 'center',
    width: '100%',
  },
  tokenCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tokenCostText: {
    fontFamily: FONTS.uiBold,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
