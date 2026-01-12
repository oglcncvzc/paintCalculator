declare module 'imagetracerjs' {
    interface Options {
        ltres?: number;
        qtres?: number;
        pathomit?: number;
        rightangleenhance?: boolean;
        colorsampling?: number;
        numberofcolors?: number;
        mincolorratio?: number;
        colorquantcycles?: number;
        layering?: number;
        strokewidth?: number;
        viewbox?: boolean;
        desc?: boolean;
        scale?: number;
        blurradius?: number;
        blurdelta?: number;
        pal?: { r: number; g: number; b: number; a: number }[];
        [key: string]: any;
    }

    export function imageToSVG(
        source: string | HTMLImageElement,
        callback: (svgString: string) => void,
        options?: Options
    ): void;

    export function imageToTracedata(
        source: string | HTMLImageElement | string,
        callback: (tracedata: any) => void,
        options?: Options
    ): void;

    export function getsvgstring(
        tracedata: any,
        options?: Options
    ): string;

    const ImageTracer: {
        imageToSVG: typeof imageToSVG;
        imageToTracedata: typeof imageToTracedata;
        getsvgstring: typeof getsvgstring;
    };

    export default ImageTracer;
}
